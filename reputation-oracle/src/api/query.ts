/**
 * Reputation Query API Endpoint
 * Main endpoint for reputation scoring queries
 */

import { Request, Response } from 'express';
import { ReputationQuery, ReputationResponse } from '../types/reputation';
import { ReputationAggregator } from '../scoring/aggregator';
import { PaymentHandler } from '../x402/payment-handler';
import { x402PaymentRequiredException } from '../../a2a-x402-typescript/x402_a2a';

export class ReputationQueryHandler {
  private aggregator: ReputationAggregator;
  private paymentHandler: PaymentHandler;

  constructor(aggregator: ReputationAggregator, paymentHandler: PaymentHandler) {
    this.aggregator = aggregator;
    this.paymentHandler = paymentHandler;
  }

  /**
   * Handle reputation query request
   */
  async handleQuery(req: Request, res: Response): Promise<void> {
    try {
      const query: ReputationQuery = req.body;

      // Validate request
      if (!query.address) {
        res.status(400).json({
          success: false,
          error: 'Missing required field: address',
        } as ReputationResponse);
        return;
      }

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(query.address)) {
        res.status(400).json({
          success: false,
          error: 'Invalid Ethereum address format',
        } as ReputationResponse);
        return;
      }

      // Check for payment
      if (!query.paymentPayload) {
        // Request payment
        const paymentRequirements = await this.paymentHandler.createPaymentRequirements(
          `/reputation-query/${query.address}`
        );

        // Throw x402 payment exception (will be caught by x402 middleware)
        throw new x402PaymentRequiredException(
          `Payment of $${this.paymentHandler['config'].price.toFixed(2)} USDC required for reputation query`,
          paymentRequirements
        );
      }

      // Verify payment
      const paymentRequirements = await this.paymentHandler.createPaymentRequirements();
      const isValid = await this.paymentHandler.isValidPayment(
        query.paymentPayload,
        paymentRequirements
      );

      if (!isValid) {
        res.status(402).json({
          success: false,
          error: 'Invalid or missing payment',
        } as ReputationResponse);
        return;
      }

      // Generate query ID
      const queryId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Calculate reputation score
      const reputationScore = await this.aggregator.calculateReputationScore(
        query.address,
        queryId,
        query.requesterAddress || query.agentId
      );

      // Settle payment after successful query
      await this.paymentHandler.settlePaymentAfterQuery(
        query.paymentPayload,
        paymentRequirements
      );

      // Return success response
      res.status(200).json({
        success: true,
        score: reputationScore,
        message: `Reputation score calculated for ${query.address}`,
      } as ReputationResponse);
    } catch (error: any) {
      // Re-throw x402 payment exceptions (handled by middleware)
      if (error instanceof x402PaymentRequiredException) {
        throw error;
      }

      console.error('Error handling reputation query:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      } as ReputationResponse);
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'healthy',
      service: 'reputation-scoring-oracle',
      version: '0.1.0',
      timestamp: Date.now(),
    });
  }
}

