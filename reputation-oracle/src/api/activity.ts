/**
 * Activity Registration API
 * Allows agents to register their on-chain activities (paid - $0.01)
 */

import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { Agent0DataFetcher } from '../agent0/data-fetcher';
import { MerchantExecutor } from '../x402/MerchantExecutor';
import type { PaymentPayload } from 'x402/types';

export interface ActivityRegistration {
  agentId?: string;
  walletAddress?: string;
  activity: {
    type: 'transaction' | 'interaction' | 'payment' | 'custom';
    data: {
      txHash?: string;
      network?: string;
      timestamp?: number;
      counterparty?: string;
      amount?: string;
      asset?: string;
      description?: string;
      [key: string]: any;
    };
  };
  signature: string;
}

export class ActivityHandler {
  private agent0DataFetcher: Agent0DataFetcher;
  private activities: Map<string, ActivityRegistration[]>; // In-memory storage (can be replaced with DB)

  constructor(agent0DataFetcher: Agent0DataFetcher) {
    this.agent0DataFetcher = agent0DataFetcher;
    this.activities = new Map();
  }

  /**
   * Register agent activity (requires x402 payment)
   */
  async registerActivity(
    req: Request, 
    res: Response, 
    merchantExecutor: MerchantExecutor
  ): Promise<Response | void> {
    try {
      console.log('\n📥 Received activity registration request');

      // Support both A2A message format and simple JSON
      const message = req.body.message || req.body;
      const paymentPayload = message.metadata?.['x402.payment.payload'] as PaymentPayload | undefined;
      const paymentStatus = message.metadata?.['x402.payment.status'];

      // Check for payment
      if (!paymentPayload || paymentStatus !== 'payment-submitted') {
        const paymentRequired = merchantExecutor.createPaymentRequiredResponse();
        console.log('💰 Payment required for activity registration');
        return res.status(402).json({
          x402Version: 1,
          accepts: paymentRequired.accepts,
          error: paymentRequired.error,
        });
      }

      // Verify payment
      console.log('🔍 Verifying payment...');
      const verifyResult = await merchantExecutor.verifyPayment(paymentPayload);

      if (!verifyResult.isValid) {
        console.log(`❌ Payment verification failed: ${verifyResult.invalidReason}`);
        return res.status(402).json({
          success: false,
          error: verifyResult.invalidReason || 'Payment verification failed',
        });
      }

      console.log(`✅ Payment verified from: ${verifyResult.payer}`);

      // Extract activity data from message parts or body
      let activityData: ActivityRegistration;
      if (message.parts && Array.isArray(message.parts)) {
        // A2A format
        const textParts = message.parts
          .filter((p: any) => p.kind === 'text')
          .map((p: any) => p.text)
          .join(' ');
        try {
          activityData = JSON.parse(textParts);
        } catch {
          activityData = req.body;
        }
      } else {
        activityData = req.body;
      }

      // Validate required fields
      if (!activityData.agentId && !activityData.walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: agentId or walletAddress',
        });
      }

      if (!activityData.activity || !activityData.signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: activity and signature',
        });
      }

      // Resolve agent ID to wallet address if needed
      let walletAddress: string | undefined = activityData.walletAddress;
      if (activityData.agentId && !walletAddress) {
        if (!Agent0DataFetcher.isValidAgentId(activityData.agentId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Agent0 ID format',
          });
        }

        const resolved = await this.agent0DataFetcher.getAgentWalletAddress(activityData.agentId);
        if (!resolved) {
          return res.status(404).json({
            success: false,
            error: `Agent not found: ${activityData.agentId}`,
          });
        }
        walletAddress = resolved;
      }

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing walletAddress or invalid agentId',
        });
      }

      // Verify signature
      const isValid = await this.verifySignature(activityData, walletAddress);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature',
        });
      }

      // Store activity
      if (!this.activities.has(walletAddress)) {
        this.activities.set(walletAddress, []);
      }
      this.activities.get(walletAddress)!.push(activityData);

      // Settle payment
      console.log('💰 Settling payment...');
      const settlement = await merchantExecutor.settlePayment(paymentPayload);

      // Generate activity ID
      const activityId = `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      console.log('✅ Activity registered successfully');
      return res.status(200).json({
        success: true,
        activityId,
        message: 'Activity registered successfully',
        settlement: {
          success: settlement.success,
          transaction: settlement.transaction,
          network: settlement.network,
        },
      });
    } catch (error: any) {
      console.error('❌ Error registering activity:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Get activities for an agent (free endpoint)
   */
  async getActivities(req: Request, res: Response): Promise<Response | void> {
    try {
      const { agentId, address } = req.params;

      let walletAddress: string | undefined = address;

      // Resolve agent ID if provided
      if (agentId && !address) {
        if (!Agent0DataFetcher.isValidAgentId(agentId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid Agent0 ID format',
          });
        }

        const resolved = await this.agent0DataFetcher.getAgentWalletAddress(agentId);
        if (!resolved) {
          return res.status(404).json({
            success: false,
            error: `Agent not found: ${agentId}`,
          });
        }
        walletAddress = resolved;
      }

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameter: agentId or address',
        });
      }

      const activities = this.activities.get(walletAddress) || [];

      return res.status(200).json({
        success: true,
        address: walletAddress,
        agentId: agentId || null,
        activities,
        count: activities.length,
      });
    } catch (error: any) {
      console.error('Error fetching activities:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Verify wallet signature
   */
  private async verifySignature(
    activityData: ActivityRegistration,
    expectedAddress: string
  ): Promise<boolean> {
    try {
      // Create message to verify
      const message = JSON.stringify({
        agentId: activityData.agentId,
        walletAddress: activityData.walletAddress,
        activity: activityData.activity,
      });

      // Recover address from signature
      const recoveredAddress = ethers.verifyMessage(message, activityData.signature);

      // Normalize addresses for comparison
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }
}
