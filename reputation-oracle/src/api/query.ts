/**
 * Reputation Query API Endpoint
 * Main endpoint for reputation scoring queries with x402 payment
 */

import { Request, Response } from 'express';
import { ReputationQuery, ReputationResponse } from '../types/reputation';
import { ReputationAggregator } from '../scoring/aggregator';
import { MerchantExecutor } from '../x402/MerchantExecutor';
import { Agent0DataFetcher } from '../agent0/data-fetcher';
import type { PaymentPayload } from 'x402/dist/cjs/types';

/**
 * Convert BigInt values to strings recursively for JSON serialization
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeBigInt(obj[key]);
      }
    }
    return result;
  }
  
  return obj;
}

export class ReputationQueryHandler {
  private aggregator: ReputationAggregator;
  private merchantExecutor: MerchantExecutor;
  private agent0DataFetcher: Agent0DataFetcher;

  constructor(
    aggregator: ReputationAggregator,
    merchantExecutor: MerchantExecutor,
    agent0DataFetcher: Agent0DataFetcher
  ) {
    this.aggregator = aggregator;
    this.merchantExecutor = merchantExecutor;
    this.agent0DataFetcher = agent0DataFetcher;
  }

  /**
   * Handle reputation query request
   * Supports both A2A message format and simple JSON
   */
  async handleQuery(req: Request, res: Response): Promise<Response | void> {
    try {
      console.log('\n📥 Received reputation query request');
      
      // Support both A2A message format and simple JSON
      const message = req.body.message || req.body;
      const paymentPayload = message.metadata?.['x402.payment.payload'] as PaymentPayload | undefined;
      const paymentStatus = message.metadata?.['x402.payment.status'];
      
      // Extract query parameters from message parts or body
      let query: ReputationQuery;
      if (message.parts && Array.isArray(message.parts)) {
        // A2A format - extract from text parts
        const textParts = message.parts
          .filter((p: any) => p.kind === 'text')
          .map((p: any) => p.text)
          .join(' ');
        
        try {
          query = JSON.parse(textParts);
        } catch {
          // Fallback: try to extract from body
          query = {
            agentId: req.body.agentId,
            address: req.body.address,
            requesterAddress: req.body.requesterAddress,
          };
        }
      } else {
        // Simple JSON format
        query = {
          agentId: req.body.agentId || message.agentId,
          address: req.body.address || message.address,
          requesterAddress: req.body.requesterAddress || message.requesterAddress,
        };
      }

      // Check for payment (A2A format)
      if (!paymentPayload || paymentStatus !== 'payment-submitted') {
        const paymentRequired = this.merchantExecutor.createPaymentRequiredResponse();
        console.log('💰 Payment required for reputation query');

        // Return payment requirement (402 status)
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
        } as ReputationResponse);
      }

      console.log(`✅ Payment verified from: ${verifyResult.payer}`);

      // Resolve agent ID to address if provided
      let targetAddress = query.address;
      let agent0Info = null;

      // If agentId is provided, resolve it to address
      if (query.agentId && !query.address) {
        if (!Agent0DataFetcher.isValidAgentId(query.agentId)) {
          return res.status(400).json({
          success: false,
            error: 'Invalid Agent0 ID format. Expected format: "chainId:tokenId"',
        } as ReputationResponse);
      }

        // Fetch agent info from Agent0 (may fail if SDK unavailable)
        try {
          agent0Info = await this.agent0DataFetcher.getAgentInfo(query.agentId);
          
          if (!agent0Info || !agent0Info.walletAddress) {
            return res.status(404).json({
              success: false,
              error: `Agent not found: ${query.agentId}`,
            } as ReputationResponse);
          }

          targetAddress = agent0Info.walletAddress;
        } catch (agent0Error: any) {
          // Agent0 SDK unavailable - return helpful error
          return res.status(503).json({
            success: false,
            error: `Agent0 SDK unavailable: ${agent0Error.message}. Please provide wallet address directly instead of agentId.`,
          } as ReputationResponse);
        }
      }

      // Validate request - need either address or agentId
      if (!targetAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: address or agentId',
        } as ReputationResponse);
      }

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format',
        } as ReputationResponse);
      }

      // Generate query ID
      const queryId = `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Calculate reputation score
      console.log(`📊 Calculating reputation score for ${targetAddress}...`);
      const reputationScore = await this.aggregator.calculateReputationScore(
        targetAddress,
        queryId,
        query.requesterAddress || query.agentId || verifyResult.payer
      );

      // Settle payment after successful query (non-blocking - payment already verified)
      console.log('💰 Attempting payment settlement...');
      let settlement;
      try {
        settlement = await this.merchantExecutor.settlePayment(paymentPayload);
        if (!settlement.success) {
          console.log('ℹ️  Settlement unsuccessful (non-critical - payment already verified)');
        }
      } catch (settlementError: any) {
        // Don't fail the query if settlement fails - payment was already verified
        console.log(`ℹ️  Settlement skipped (non-critical): ${settlementError.message}`);
        settlement = {
          success: false,
          network: this.merchantExecutor.getPaymentRequirements().network,
          errorReason: settlementError.message || 'Settlement not configured',
        };
      }

      // Enhance response with Agent0 info if available
      // Serialize BigInt values before JSON.stringify
      const response: any = serializeBigInt({
        success: true,
        score: reputationScore,
        message: `Reputation score calculated for ${targetAddress}`,
        settlement: {
          success: settlement.success,
          transaction: settlement.transaction,
          network: settlement.network,
          payer: settlement.payer,
          errorReason: settlement.errorReason,
        },
      });

      // Add Agent0 information if available
      if (agent0Info || query.agentId) {
        response.agent0 = agent0Info || {
          agentId: query.agentId,
        };
      }

      console.log('✅ Query completed successfully');
      return res.status(200).json(response);
    } catch (error: any) {
      console.error('❌ Error handling reputation query:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      } as ReputationResponse);
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    const requirements = this.merchantExecutor.getPaymentRequirements();
    res.status(200).json({
      status: 'healthy',
      service: 'reputation-scoring-oracle',
      version: '0.1.0',
      timestamp: Date.now(),
      payment: {
        address: requirements.payTo,
        network: requirements.network,
        price: `$${(parseInt(requirements.maxAmountRequired) / 1_000_000).toFixed(2)}`,
      },
    });
  }
}
