/**
 * Feedback API
 * Allows agents to submit feedback about other agents using Agent0 SDK (paid - $0.01)
 */

import { Request, Response } from 'express';
import { Agent0FeedbackClient, FeedbackData } from '../agent0/feedback-client';
import { MerchantExecutor } from '../x402/MerchantExecutor';
import { Agent0DataFetcher } from '../agent0/data-fetcher';
import type { PaymentPayload } from 'x402/types';

export interface FeedbackRequest {
  targetAgentId: string;
  score: number; // 0-100 (mandatory)
  tags?: string[];
  capability?: string;
  name?: string;
  skill?: string;
  task?: string;
  context?: Record<string, any>;
}

export class FeedbackHandler {
  private feedbackClient: Agent0FeedbackClient;
  private merchantExecutor: MerchantExecutor;
  private agent0DataFetcher: Agent0DataFetcher;

  constructor(
    feedbackClient: Agent0FeedbackClient,
    merchantExecutor: MerchantExecutor,
    agent0DataFetcher: Agent0DataFetcher
  ) {
    this.feedbackClient = feedbackClient;
    this.merchantExecutor = merchantExecutor;
    this.agent0DataFetcher = agent0DataFetcher;
  }

  /**
   * Submit feedback about an agent (requires x402 payment)
   */
  async submitFeedback(req: Request, res: Response): Promise<Response | void> {
    try {
      console.log('\n📥 Received feedback submission request');

      // Support both A2A message format and simple JSON
      const message = req.body.message || req.body;
      const paymentPayload = message.metadata?.['x402.payment.payload'] as PaymentPayload | undefined;
      const paymentStatus = message.metadata?.['x402.payment.status'];

      // Check for payment
      if (!paymentPayload || paymentStatus !== 'payment-submitted') {
        const paymentRequired = this.merchantExecutor.createPaymentRequiredResponse();
        console.log('💰 Payment required for feedback submission');
        return res.status(402).json({
          x402Version: 1,
          accepts: paymentRequired.accepts,
          error: paymentRequired.error,
        });
      }

      // Verify payment
      console.log('🔍 Verifying payment...');
      const verifyResult = await this.merchantExecutor.verifyPayment(paymentPayload);

      if (!verifyResult.isValid) {
        console.log(`❌ Payment verification failed: ${verifyResult.invalidReason}`);
        return res.status(402).json({
          success: false,
          error: verifyResult.invalidReason || 'Payment verification failed',
        });
      }

      console.log(`✅ Payment verified from: ${verifyResult.payer}`);

      // Extract feedback data from message parts or body
      let feedbackData: FeedbackRequest;
      if (message.parts && Array.isArray(message.parts)) {
        // A2A format
        const textParts = message.parts
          .filter((p: any) => p.kind === 'text')
          .map((p: any) => p.text)
          .join(' ');
        try {
          feedbackData = JSON.parse(textParts);
        } catch {
          feedbackData = req.body;
        }
      } else {
        feedbackData = req.body;
      }

      // Validate required fields
      if (!feedbackData.targetAgentId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: targetAgentId',
        });
      }

      if (feedbackData.score === undefined || feedbackData.score < 0 || feedbackData.score > 100) {
        return res.status(400).json({
          success: false,
          error: 'Missing or invalid score (must be 0-100)',
        });
      }

      // Validate Agent0 ID format
      if (!Agent0DataFetcher.isValidAgentId(feedbackData.targetAgentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Agent0 ID format. Expected format: "chainId:tokenId"',
        });
      }

      // Check if agent exists
      const agentInfo = await this.agent0DataFetcher.getAgentInfo(feedbackData.targetAgentId);
      if (!agentInfo) {
        return res.status(404).json({
          success: false,
          error: `Agent not found: ${feedbackData.targetAgentId}`,
        });
      }

      // Prepare feedback data
      const agent0Feedback: FeedbackData = {
        agentId: feedbackData.targetAgentId,
        score: feedbackData.score,
        tags: feedbackData.tags,
        capability: feedbackData.capability,
        name: feedbackData.name,
        skill: feedbackData.skill,
        task: feedbackData.task,
        context: feedbackData.context,
        proofOfPayment: verifyResult.payer
          ? {
              txHash: '', // Will be filled after settlement
              amount: this.merchantExecutor.getPaymentRequirements().maxAmountRequired,
              asset: this.merchantExecutor.getPaymentRequirements().asset,
            }
          : undefined,
      };

      // Submit feedback on-chain via Agent0 SDK
      const feedbackId = await this.feedbackClient.giveFeedback(agent0Feedback);

      // Settle payment
      console.log('💰 Settling payment...');
      const settlement = await this.merchantExecutor.settlePayment(paymentPayload);

      // Update proof of payment if we have a transaction
      if (settlement.transaction && agent0Feedback.proofOfPayment) {
        agent0Feedback.proofOfPayment.txHash = settlement.transaction;
      }

      console.log('✅ Feedback submitted successfully');
      return res.status(200).json({
        success: true,
        feedbackId,
        message: 'Feedback submitted successfully',
        targetAgentId: feedbackData.targetAgentId,
        settlement: {
          success: settlement.success,
          transaction: settlement.transaction,
          network: settlement.network,
        },
      });
    } catch (error: any) {
      console.error('❌ Error submitting feedback:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Get feedback summary for an agent (free endpoint)
   */
  async getFeedbackSummary(req: Request, res: Response): Promise<Response | void> {
    try {
      const { agentId } = req.params;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: agentId',
        });
      }

      if (!Agent0DataFetcher.isValidAgentId(agentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Agent0 ID format',
        });
      }

      // Get reputation summary from Agent0
      const summary = await this.agent0DataFetcher.getReputationSummary(agentId);

      if (!summary) {
        return res.status(404).json({
          success: false,
          error: `No feedback found for agent: ${agentId}`,
        });
      }

      return res.status(200).json({
        success: true,
        agentId,
        summary,
      });
    } catch (error: any) {
      console.error('Error fetching feedback summary:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Search feedback (free endpoint)
   */
  async searchFeedback(req: Request, res: Response): Promise<Response | void> {
    try {
      const { agentId } = req.params;
      const { tags, capabilities, skills, minScore, maxScore } = req.query;

      if (!agentId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: agentId',
        });
      }

      if (!Agent0DataFetcher.isValidAgentId(agentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Agent0 ID format',
        });
      }

      const feedback = await this.feedbackClient.searchFeedback({
        agentId,
        tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
        capabilities: capabilities
          ? Array.isArray(capabilities)
            ? (capabilities as string[])
            : [capabilities as string]
          : undefined,
        skills: skills
          ? Array.isArray(skills)
            ? (skills as string[])
            : [skills as string]
          : undefined,
        minScore: minScore ? parseInt(minScore as string, 10) : undefined,
        maxScore: maxScore ? parseInt(maxScore as string, 10) : undefined,
      });

      return res.status(200).json({
        success: true,
        agentId,
        feedback,
        count: feedback.length,
      });
    } catch (error: any) {
      console.error('Error searching feedback:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }
}
