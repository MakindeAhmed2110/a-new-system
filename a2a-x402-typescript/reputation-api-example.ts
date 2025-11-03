/**
 * Example: How to call the Reputation Oracle API from a2a-x402 agents
 * 
 * This demonstrates how to integrate the reputation scoring oracle
 * into your a2a-x402 client or merchant agents.
 */

import { processPayment, x402Utils } from 'a2a-x402';
import { Wallet } from 'ethers';

// Configuration - update with your Railway deployment URL
const REPUTATION_ORACLE_URL = process.env.REPUTATION_ORACLE_URL || 'http://localhost:3000';

/**
 * Query reputation score for an address or agent
 * Handles x402 payment flow automatically
 */
export async function queryReputation(
  addressOrAgentId: string,
  wallet?: Wallet
): Promise<{
  score: number;
  breakdown: any;
  settlement?: any;
}> {
  console.log(`🔍 Querying reputation for: ${addressOrAgentId}`);

  try {
    // Step 1: Make initial request (will get 402 if payment required)
    const response = await fetch(`${REPUTATION_ORACLE_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: addressOrAgentId.includes(':') ? undefined : addressOrAgentId,
        agentId: addressOrAgentId.includes(':') ? addressOrAgentId : undefined,
      }),
    });

    // Step 2: Handle payment requirement (402 status)
    if (response.status === 402) {
      if (!wallet) {
        throw new Error('Wallet required for payment but not provided');
      }

      const paymentReq = await response.json();
      console.log('💰 Payment required:', paymentReq);

      // Step 3: Process payment using a2a-x402
      const paymentPayload = await processPayment(
        paymentReq.accepts[0],
        wallet
      );

      // Step 4: Retry request with payment
      const paidResponse = await fetch(`${REPUTATION_ORACLE_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x402-payment-payload': JSON.stringify(paymentPayload),
        },
        body: JSON.stringify({
          address: addressOrAgentId.includes(':') ? undefined : addressOrAgentId,
          agentId: addressOrAgentId.includes(':') ? addressOrAgentId : undefined,
        }),
      });

      if (!paidResponse.ok) {
        throw new Error(`API error: ${paidResponse.status} ${paidResponse.statusText}`);
      }

      const result = await paidResponse.json();
      console.log('✅ Reputation score retrieved:', result);
      return result.score;
    }

    // Free endpoint or already paid
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result.score;
  } catch (error) {
    console.error('❌ Reputation query failed:', error);
    throw error;
  }
}

/**
 * Get agent information (free endpoint)
 */
export async function getAgentInfo(agentId: string): Promise<any> {
  const response = await fetch(`${REPUTATION_ORACLE_URL}/agent/${agentId}/info`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get feedback summary for an agent (free endpoint)
 */
export async function getAgentFeedback(agentId: string): Promise<any> {
  const response = await fetch(`${REPUTATION_ORACLE_URL}/agent/${agentId}/feedback`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Submit feedback about an agent (paid - $0.01)
 */
export async function submitFeedback(
  agentId: string,
  score: number, // 0-100
  tags?: string[],
  wallet?: Wallet
): Promise<string> {
  console.log(`📝 Submitting feedback for agent ${agentId}: score ${score}`);

  try {
    // Step 1: Make initial request
    const response = await fetch(`${REPUTATION_ORACLE_URL}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentId,
        score,
        tags,
      }),
    });

    // Step 2: Handle payment requirement
    if (response.status === 402) {
      if (!wallet) {
        throw new Error('Wallet required for payment but not provided');
      }

      const paymentReq = await response.json();
      const paymentPayload = await processPayment(paymentReq.accepts[0], wallet);

      // Step 3: Retry with payment
      const paidResponse = await fetch(`${REPUTATION_ORACLE_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x402-payment-payload': JSON.stringify(paymentPayload),
        },
        body: JSON.stringify({
          agentId,
          score,
          tags,
        }),
      });

      if (!paidResponse.ok) {
        throw new Error(`API error: ${paidResponse.status}`);
      }

      const result = await paidResponse.json();
      console.log('✅ Feedback submitted:', result);
      return result.feedbackId || result.id;
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    return result.feedbackId || result.id;
  } catch (error) {
    console.error('❌ Feedback submission failed:', error);
    throw error;
  }
}

/**
 * Health check
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${REPUTATION_ORACLE_URL}/health`);
    const data = await response.json();
    return data.status === 'healthy';
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return false;
  }
}

// Example usage in an agent tool:
/*
export async function checkAgentReputation(
  params: { address: string },
  context?: ToolContext
): Promise<string> {
  const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY!);
  
  try {
    const reputation = await queryReputation(params.address, wallet);
    
    return `Agent ${params.address} has a reputation score of ${reputation.score}/100.
    
Breakdown:
- ENS: ${reputation.breakdown.ens.score}/100
- On-Chain: ${reputation.breakdown.onchain.score}/100
- Wallet Age: ${reputation.breakdown.walletAge.score}/100
- Social: ${reputation.breakdown.social.score}/100

This agent is ${reputation.score >= 70 ? 'highly trusted' : reputation.score >= 50 ? 'moderately trusted' : 'low trust'}.`;
  } catch (error) {
    return `Failed to check reputation: ${error instanceof Error ? error.message : String(error)}`;
  }
}
*/

