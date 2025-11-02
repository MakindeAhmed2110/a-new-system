/**
 * x402 Payment Handler
 * Handles payment verification and settlement for oracle queries
 */

import {
  verifyPayment,
  settlePayment,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  createPaymentRequirements,
  DefaultFacilitatorClient,
  FacilitatorClient,
} from '../../a2a-x402-typescript/x402_a2a';

export interface PaymentConfig {
  price: number; // USD amount (e.g., 0.50 for $0.50)
  payToAddress: string;
  network: string;
  usdcContract?: string;
  facilitator?: FacilitatorClient;
}

export class PaymentHandler {
  private config: PaymentConfig;
  private facilitator: FacilitatorClient;

  constructor(config: PaymentConfig) {
    this.config = config;
    // Use custom facilitator if provided, otherwise use default
    this.facilitator = config.facilitator || new DefaultFacilitatorClient();
  }

  /**
   * Create payment requirements for a reputation query
   */
  async createPaymentRequirements(resource: string = '/reputation-query'): Promise<PaymentRequirements> {
    return createPaymentRequirements({
      price: this.config.price,
      payToAddress: this.config.payToAddress,
      resource,
      network: this.config.network as any,
      description: `Reputation scoring oracle query - $${this.config.price.toFixed(2)} USDC`,
      mimeType: 'application/json',
      maxTimeoutSeconds: 600,
    });
  }

  /**
   * Verify payment before processing query
   */
  async verifyPaymentPayload(
    paymentPayload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    return verifyPayment(paymentPayload, requirements, this.facilitator);
  }

  /**
   * Settle payment after successful query
   */
  async settlePaymentAfterQuery(
    paymentPayload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    return settlePayment(paymentPayload, requirements, this.facilitator);
  }

  /**
   * Check if payment is valid
   */
  async isValidPayment(
    paymentPayload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<boolean> {
    const verification = await this.verifyPaymentPayload(paymentPayload, requirements);
    return verification.isValid;
  }
}

