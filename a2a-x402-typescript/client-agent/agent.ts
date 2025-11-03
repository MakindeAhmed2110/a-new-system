//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * x402 Client Agent - Orchestrator agent with payment capabilities
 *
 * This agent can discover and interact with remote agents (like merchants),
 * automatically handling payment flows when required.
 */

import { LlmAgent as Agent } from 'adk-typescript/agents';
import { ToolContext } from 'adk-typescript/tools';
import { LiteLlm } from 'adk-typescript/models';
import { LocalWallet } from './src/wallet/Wallet';
import { x402Utils, PaymentStatus } from 'a2a-x402';
import { Wallet } from 'ethers';
import { logger } from './src/logger';

// --- Client Agent Configuration ---

const MERCHANT_AGENT_URL = process.env.MERCHANT_AGENT_URL || 'http://localhost:10000';
const REPUTATION_ORACLE_URL = process.env.REPUTATION_ORACLE_URL || 'http://localhost:3000';
const MERCHANT_WALLET_ADDRESS = process.env.MERCHANT_WALLET_ADDRESS; // Optional: pre-configured merchant address

// --- OpenRouter Configuration ---
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

// Validate OpenRouter API key
if (!OPENROUTER_API_KEY) {
  console.error('❌ ERROR: OPENROUTER_API_KEY not set in .env file');
  console.error('   Please add OPENROUTER_API_KEY to your .env file');
  throw new Error('Missing required environment variable: OPENROUTER_API_KEY');
}

// Set environment variables for LiteLLM to use OpenRouter
// LiteLLM reads these environment variables to configure API access
// For OpenRouter, we set OpenAI vars since OpenRouter is OpenAI-compatible
process.env.OPENAI_API_KEY = OPENROUTER_API_KEY;
process.env.OPENAI_API_BASE = OPENROUTER_BASE_URL;

// Configure LiteLlm with OpenRouter
// CRITICAL: LiteLLM routes based on model name prefix and may ignore api_base for known providers
// SOLUTION: Use the model name directly with api_base set - LiteLLM should respect api_base when explicitly set
// OpenRouter model format: openai/gpt-4o (this is what OpenRouter expects)
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o';

// Create LiteLlm instance configured for OpenRouter
// CRITICAL FIX: LiteLLM expects baseUrl (camelCase) and apiKey, not api_base and api_key
// The OpenAIHandler will use baseUrl when provided, routing to OpenRouter instead of OpenAI
const openRouterLlm = new LiteLlm(OPENROUTER_MODEL, {
  apiKey: OPENROUTER_API_KEY,      // camelCase, not snake_case
  baseUrl: OPENROUTER_BASE_URL,     // camelCase, not snake_case
});

console.log(`🔌 OpenRouter Configuration:
  Model: ${OPENROUTER_MODEL}
  Base URL: ${OPENROUTER_BASE_URL}
  API Key: ${OPENROUTER_API_KEY ? 'Set (hidden)' : 'NOT SET'}
`);

logger.log(`🤖 Client Agent Configuration:
  Merchant URL: ${MERCHANT_AGENT_URL}
  Reputation Oracle: ${REPUTATION_ORACLE_URL}
  Merchant Wallet: ${MERCHANT_WALLET_ADDRESS || 'will be retrieved from payment requirements'}
`);

// Initialize wallet
const wallet = new LocalWallet();
const x402 = new x402Utils();

// State management
interface AgentState {
  sessionId?: string;
  pendingPayment?: {
    agentUrl: string;
    agentName: string;
    requirements: any;
    taskId?: string;
    contextId?: string;
  };
}

const state: AgentState = {};

// Helper to ensure we have a session
async function ensureSession(): Promise<string> {
  if (state.sessionId) {
    return state.sessionId;
  }

  // Create a new session
  try {
    const response = await fetch(`${MERCHANT_AGENT_URL}/apps/x402_merchant_agent/users/client-user/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }

    const session = await response.json() as any;
    state.sessionId = session.id;
    logger.log(`✅ Created new session: ${state.sessionId}`);
    return state.sessionId!;
  } catch (error) {
    logger.error('❌ Failed to create session:', error);
    throw error;
  }
}

// --- Reputation Checking Functions ---

/**
 * Helper to add timeout to async operations
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Query reputation score from the reputation oracle
 */
async function queryReputation(
  addressOrAgentId: string,
  wallet: Wallet
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
      const paymentReq = await response.json() as {
        accepts: Array<{
          scheme: string;
          network: string;
          asset: string;
          payTo: string;
          maxAmountRequired: string;
          resource?: string;
          description?: string;
          mimeType?: string;
          maxTimeoutSeconds?: number;
          [key: string]: any;
        }>;
        [key: string]: any;
      };
      console.log('💰 Reputation query requires payment:', paymentReq);

      // Step 3: Process payment using a2a-x402
      const { processPayment } = await import('a2a-x402');
      const paymentPayload = await processPayment(
        paymentReq.accepts[0] as any, // Type assertion needed for dynamic payment requirements
        wallet
      );

      // Step 4: Retry request with payment (reputation oracle expects payment in metadata)
      const paidResponse = await fetch(`${REPUTATION_ORACLE_URL}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: addressOrAgentId.includes(':') ? undefined : addressOrAgentId,
          agentId: addressOrAgentId.includes(':') ? addressOrAgentId : undefined,
          metadata: {
            'x402.payment.payload': paymentPayload,
            'x402.payment.status': 'payment-submitted',
          },
        }),
      });

      if (!paidResponse.ok) {
        throw new Error(`API error: ${paidResponse.status} ${paidResponse.statusText}`);
      }

      const result = await paidResponse.json() as any;
      console.log('✅ Reputation score retrieved:', result);
      
      // Handle both direct score object and nested score object
      if (result.score) {
        if (typeof result.score === 'object' && 'score' in result.score && 'breakdown' in result.score) {
          return result.score as { score: number; breakdown: any; settlement?: any };
        }
        return { score: result.score as number, breakdown: {} };
      }
      
      // If no score property, try to extract from result directly
      if (result.score !== undefined || (typeof result === 'object' && 'score' in result)) {
        return {
          score: result.score || (result as any).score || 0,
          breakdown: result.breakdown || result.score?.breakdown || {},
          settlement: result.settlement
        };
      }
      
      // Fallback: return with defaults
      return { score: 0, breakdown: {}, settlement: result.settlement };
    }

    // Free endpoint or already paid
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as any;
    
    // Handle both direct score object and nested score object
    if (result.score) {
      if (typeof result.score === 'object' && 'score' in result.score && 'breakdown' in result.score) {
        return result.score as { score: number; breakdown: any; settlement?: any };
      }
      return { score: result.score as number, breakdown: {} };
    }
    
    // If no score property, try to extract from result directly
    if (result.score !== undefined || (typeof result === 'object' && 'score' in result)) {
      return {
        score: result.score || (result as any).score || 0,
        breakdown: result.breakdown || result.score?.breakdown || {},
        settlement: result.settlement
      };
    }
    
    // Fallback: return with defaults
    return { score: 0, breakdown: {}, settlement: result.settlement };
  } catch (error) {
    console.error('❌ Reputation query failed:', error);
    throw error;
  }
}

/**
 * Check merchant reputation before transaction
 */
async function checkMerchantReputation(
  params: Record<string, any>,
  context?: ToolContext
): Promise<string> {
  const merchantAddress = params.address || params.merchantAddress || MERCHANT_WALLET_ADDRESS;

  if (!merchantAddress) {
    return '⚠️ Cannot check reputation: merchant address not provided. The reputation check will be performed automatically when payment details are received.';
  }

  logger.log(`\n🛡️ Checking merchant reputation for: ${merchantAddress}`);

  try {
    // Get wallet instance from LocalWallet
    const ethersWallet = wallet.getWallet() as Wallet;
    
    const reputation = await queryReputation(merchantAddress, ethersWallet);

    const score = reputation.score || 0;
    const breakdown = reputation.breakdown || {};
    
    const trustLevel = score >= 70 ? 'Highly Trusted ✅' : score >= 50 ? 'Moderately Trusted ⚠️' : 'Low Trust ❌';
    const recommendation = score >= 70 ? 'Safe to proceed' : score >= 50 ? 'Proceed with caution' : 'Consider not proceeding';

    logger.log(`✅ Reputation check complete: ${score}/100`);

    return `🛡️ **Merchant Reputation Report**

**Overall Score:** ${score}/100 - ${trustLevel}

**Breakdown:**
- ENS Identity: ${breakdown.ens?.score || 'N/A'}/100 (20% weight)
- On-Chain Activity: ${breakdown.onchain?.score || 'N/A'}/100 (30% weight)
- Wallet Age: ${breakdown.walletAge?.score || 'N/A'}/100 (15% weight)
- Social Profiles: ${breakdown.social?.score || 'N/A'}/100 (35% weight)

**Recommendation:** ${recommendation}

${score < 50 ? '⚠️ WARNING: This merchant has a low reputation score. Consider verifying their identity or using a smaller transaction amount.' : ''}`;

  } catch (error: any) {
    logger.error('❌ Reputation check failed:', error);
    const errorMsg = error.message || String(error);
    
    if (errorMsg.includes('REPUTATION_ORACLE_URL') || errorMsg.includes('ECONNREFUSED')) {
      return `⚠️ Could not check reputation: Reputation oracle is not accessible at ${REPUTATION_ORACLE_URL}. Proceeding without reputation check.`;
    }
    
    return `⚠️ Reputation check failed: ${errorMsg}. Proceeding without reputation verification.`;
  }
}

// --- Tool Functions ---

/**
 * Send a message to a remote merchant agent using ADK protocol
 * Now includes reputation checking before transaction
 */
async function sendMessageToMerchant(
  params: Record<string, any>,
  context?: ToolContext
): Promise<string> {
  // Handle both direct string and object with message/params field
  const message = typeof params === 'string' ? params : (params.message || params.params || params);

  logger.log(`\n📤 Sending message to merchant: "${message}"`);

  try {
    // Ensure we have a session
    const sessionId = await ensureSession();

    // Make real HTTP request to merchant server using ADK /run endpoint
    const response = await fetch(`${MERCHANT_AGENT_URL}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appName: 'x402_merchant_agent',
        userId: 'client-user',
        sessionId: sessionId,
        newMessage: {
          role: 'user',
          parts: [{ text: String(message) }],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`❌ Merchant server error (${response.status}): ${errorText}`);
      return `Sorry, I couldn't connect to the merchant. The server returned an error: ${response.status}. Make sure the merchant server is running at ${MERCHANT_AGENT_URL}`;
    }

    const events = await response.json() as any[];
    logger.log(`✅ Received ${events.length} events from merchant`);
    logger.log('📊 All events:', JSON.stringify(events, null, 2));

    // ADK returns an array of events - process them
    // CRITICAL: Check ALL events for payment requirements FIRST, then process text responses
    // This is because the merchant sends both the agent's text response AND the payment requirement

    // First pass: Look for payment requirements in ANY event
    for (const event of events) {
      logger.log(`\n🔍 Processing event (pass 1 - payment check):
        - author: ${event.author || 'unknown'}
        - errorCode: ${event.errorCode || 'none'}
        - has content: ${!!event.content}
        - has errorData: ${!!event.errorData}`);

      // Check if this is an x402 payment exception
      if (event.errorCode && event.errorCode === 'x402_payment_required') {
        logger.log('🎯 Found payment requirement event!');
        const paymentReqs = event.errorData?.paymentRequirements;
        logger.log(`Payment requirements data:`, JSON.stringify(paymentReqs, null, 2));

        if (paymentReqs && paymentReqs.accepts && paymentReqs.accepts.length > 0) {
          const paymentOption = paymentReqs.accepts[0];
          const price = BigInt(paymentOption.maxAmountRequired);
          const priceUSDC = (Number(price) / 1_000_000).toFixed(6);
          const productName = paymentOption.extra?.product?.name || 'product';
          const merchantAddress = paymentOption.payTo;

          // Store payment requirements in state FIRST (before any async operations)
          // This ensures ADK can track the function call properly
          state.pendingPayment = {
            agentUrl: MERCHANT_AGENT_URL,
            agentName: 'merchant_agent',
            requirements: paymentReqs,
            taskId: event.invocationId,
            contextId: event.invocationId,
          };

          logger.log(`💰 Payment required: ${priceUSDC} USDC for ${productName}`);

          // Check reputation for this specific merchant address if we have it
          let reputationWarning = '';
          if (merchantAddress) {
            try {
              logger.log(`\n🛡️ Checking reputation for merchant: ${merchantAddress}`);
              const ethersWallet = wallet.getWallet() as Wallet;
              const reputation = await queryReputation(merchantAddress, ethersWallet);
              const score = reputation.score || 0;
              
              if (score < 50) {
                reputationWarning = `\n\n⚠️ **SECURITY WARNING**: This merchant has a LOW reputation score (${score}/100). Consider verifying their identity before proceeding.`;
              } else if (score < 70) {
                reputationWarning = `\n\n⚡ **Reputation Check**: Merchant score is ${score}/100 - moderate trust. Proceed with normal caution.`;
              } else {
                reputationWarning = `\n\n✅ **Reputation Verified**: Merchant has a high trust score (${score}/100).`;
              }
            } catch (error: any) {
              logger.warn(`⚠️ Could not check merchant reputation: ${error.message}`);
              reputationWarning = `\n\n⚠️ Could not verify merchant reputation. Proceed with caution.`;
            }
          }

          return `The merchant agent responded! They're selling ${productName} for ${priceUSDC} USDC.${reputationWarning}

**Payment Details:**
- Product: ${productName}
- Price: ${priceUSDC} USDC (${price.toString()} atomic units)
- Network: ${paymentOption.network}
- Payment Token: ${paymentOption.extra?.name || 'USDC'}
- Merchant Address: ${merchantAddress}

Reply "yes" to confirm the payment, or "no" to cancel.`;
        }
      }
    }

    // Second pass: No payment requirements found, look for regular text responses
    logger.log('\n📝 No payment requirements found, checking for text responses...');
    for (const event of events) {
      if (event.content && event.content.parts) {
        const textParts = event.content.parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join('\n');
        logger.log(`Text content: "${textParts}"`);
        if (textParts) {
          logger.log('✅ Returning text content from merchant');
          return `Merchant says: ${textParts}`;
        }
      }
    }

    // If we got a response but no payment requirements or message, return generic success
    return `I contacted the merchant, but received an unexpected response format. Events: ${JSON.stringify(events)}`;

  } catch (error) {
    logger.error('❌ Failed to contact merchant:', error);
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        return `❌ Cannot connect to the merchant server at ${MERCHANT_AGENT_URL}. Please make sure:\n1. The merchant server is running (npm start in merchant-agent directory)\n2. The server is accessible at ${MERCHANT_AGENT_URL}\n\nError: ${error.message}`;
      }
      return `Failed to contact merchant: ${error.message}`;
    }
    return `Failed to contact merchant: ${String(error)}`;
  }
}

// Note: Removed isLongRunning flag as it was causing ADK Step 2 crashes with auto-confirm payment

/**
 * Confirm and sign a pending payment
 */
async function confirmPayment(
  params: Record<string, any>,
  context?: ToolContext
): Promise<string> {
  if (!state.pendingPayment) {
    return 'No pending payment to confirm.';
  }

  logger.log('\n💰 User confirmed payment. Processing...');

  try {
    const paymentOption = state.pendingPayment.requirements.accepts[0];
    const tokenAddress = paymentOption.asset;
    const merchantAddress = paymentOption.payTo;
    const amount = BigInt(paymentOption.maxAmountRequired);
    const productName = paymentOption.extra?.product?.name || 'product';

    // Final reputation check before payment (critical safety check)
    // This is the ONLY place reputation is checked to avoid ADK session state issues
    let reputationWarning = '';
    let reputationScore: number | null = null;
    try {
      logger.log(`\n🛡️ Final reputation check before payment for: ${merchantAddress}`);
      const ethersWallet = wallet.getWallet() as Wallet;
      
      // Add timeout - max 5 seconds for final check
      const reputation = await withTimeout(
        queryReputation(merchantAddress, ethersWallet),
        5000,
        'Final reputation check timeout (5s)'
      );
      reputationScore = reputation.score || 0;
      
      if (reputationScore < 50) {
        logger.warn(`⚠️ LOW REPUTATION: ${reputationScore}/100 - Showing warning but allowing payment`);
        reputationWarning = `\n\n⚠️ **SECURITY WARNING**: Merchant reputation is LOW (${reputationScore}/100). Proceed with extreme caution.`;
      } else if (reputationScore < 70) {
        logger.log(`⚡ Moderate reputation: ${reputationScore}/100`);
        reputationWarning = `\n\n⚡ **Reputation Check**: Merchant score is ${reputationScore}/100 - moderate trust.`;
      } else {
        logger.log(`✅ Reputation verified: ${reputationScore}/100`);
        reputationWarning = `\n\n✅ **Reputation Verified**: Merchant has a high trust score (${reputationScore}/100).`;
      }
    } catch (error: any) {
      logger.warn(`⚠️ Final reputation check failed: ${error.message} - proceeding with payment`);
      reputationWarning = `\n\n⚠️ Could not verify merchant reputation before payment. Proceeding with caution.`;
    }

    // Step 1: Sign the payment with wallet (this also handles approval)
    const signedPayload = await wallet.signPayment(state.pendingPayment.requirements);

    logger.log('✅ Payment signed successfully!');
    logger.log(`   Signature: ${signedPayload.payload.signature.substring(0, 20)}...`);

    // Step 2: Execute the actual token transfer
    const transferResult = await wallet.executePayment(tokenAddress, merchantAddress, amount);

    if (!transferResult.success) {
      return `Payment transfer failed: ${transferResult.error}`;
    }

    logger.log(`✅ Transfer successful: ${transferResult.txHash}`);

    // Step 3: Send payment proof back to merchant server
    logger.log('\n📤 Sending payment proof to merchant...');

    try {
      const paymentResponse = await fetch(MERCHANT_AGENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `I want to buy ${productName}`, // Original request
          taskId: state.pendingPayment.taskId,
          contextId: state.pendingPayment.contextId,
          message: {
            messageId: `msg-${Date.now()}`,
            role: 'user',
            parts: [{ kind: 'text', text: `I want to buy ${productName}` }],
            metadata: {
              x402: {
                paymentStatus: 'payment-submitted',
                paymentPayload: signedPayload,
              },
            },
          },
        }),
      });

      if (!paymentResponse.ok) {
        logger.error(`❌ Failed to send payment to merchant: ${paymentResponse.status}`);
        return `⚠️ Payment was sent on-chain but merchant server returned error: ${paymentResponse.status}. Transaction: ${transferResult.txHash}`;
      }

      const paymentData = await paymentResponse.json() as any;
      logger.log('✅ Merchant received payment:', JSON.stringify(paymentData, null, 2));

      // Check for confirmation in the response
      let merchantConfirmation = '';
      if (paymentData.events && paymentData.events.length > 0) {
        for (const event of paymentData.events) {
          if (event.status?.message) {
            const msg = event.status.message;
            if (msg.parts && Array.isArray(msg.parts)) {
              const textParts = msg.parts
                .filter((p: any) => p.kind === 'text')
                .map((p: any) => p.text)
                .join('\n');
              if (textParts) {
                merchantConfirmation = `\n\n**Merchant Response:**\n${textParts}`;
              }
            }
          }
        }
      }

      const amountUSDC = (Number(amount) / 1_000_000).toFixed(6);
      const result = `✅ Payment completed successfully!${reputationWarning}

**Transaction Details:**
- Product: ${productName}
- Amount: ${amountUSDC} USDC (${amount.toString()} atomic units)
- Token: ${tokenAddress}
- Merchant: ${merchantAddress}
- Transaction: ${transferResult.txHash}
- View on BaseScan: https://sepolia.basescan.org/tx/${transferResult.txHash}${merchantConfirmation}`;

      // Clear pending payment
      state.pendingPayment = undefined;

      return result;

    } catch (error) {
      logger.error('❌ Failed to notify merchant:', error);
      return `⚠️ Payment was sent on-chain successfully but couldn't notify merchant: ${error instanceof Error ? error.message : String(error)}\n\nTransaction: ${transferResult.txHash}\nView on BaseScan: https://sepolia.basescan.org/tx/${transferResult.txHash}`;
    }

  } catch (error) {
    logger.error('❌ Payment processing failed:', error);
    return `Payment processing failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Cancel a pending payment
 */
async function cancelPayment(
  params: Record<string, any>,
  context?: ToolContext
): Promise<string> {
  if (!state.pendingPayment) {
    return 'No pending payment to cancel.';
  }

  logger.log('❌ User cancelled payment.');
  state.pendingPayment = undefined;

  return 'Payment cancelled.';
}

/**
 * Get wallet information
 */
async function getWalletInfo(
  params: Record<string, any>,
  context?: ToolContext
): Promise<string> {
  return `Wallet Address: ${wallet.getAddress()}`;
}

// --- Agent Definition ---

export const clientAgent = new Agent({
  name: 'x402_client_agent',
  model: openRouterLlm, // Use OpenRouter via LiteLlm
  description: 'An orchestrator agent that can interact with merchants and handle payments.',
  instruction: `You are a helpful client agent that assists users in buying products from merchant agents using cryptocurrency payments.

**How you work:**
This is an x402 payment demo. You can help users purchase products from merchant agents using USDC on the Base Sepolia blockchain.

**When users greet you or send unclear messages:**
Introduce yourself and explain what you can do:
- "Hi! I'm a client agent that can help you purchase products using cryptocurrency."
- "I can connect to merchant agents and handle the payment process for you."
- "Try asking me to buy something, like: 'I want to buy a banana'"
- "Your wallet is connected at: ${wallet.getAddress()}"

**When users want to buy something:**
1. Use sendMessageToMerchant to request the product from the merchant
2. The merchant will respond with payment requirements (amount in USDC)
3. Reputation is automatically checked and shown when payment details are received
4. If reputation is low (< 50), a security warning will be displayed
5. Ask the user to confirm the purchase
6. If user confirms ("yes", "confirm", "ok"), use confirmPayment to process the payment
7. If user declines ("no", "cancel"), use cancelPayment

**Important guidelines:**
- ALWAYS explain what you're doing in a friendly, clear way
- When greeting messages arrive, respond warmly and explain your capabilities
- Be transparent about payment amounts before proceeding
- Handle errors gracefully and explain what went wrong
- If the user message doesn't relate to purchasing, kindly redirect them to ask for a product

**Example interactions:**

User: "hello"
You: "Hi! I'm an x402 payment client agent. I can help you buy products from merchants using USDC cryptocurrency. Your wallet is ready at ${wallet.getAddress()}. Try asking me to buy something, like 'I want to buy a banana'!"

User: "I want to buy a banana"
You: [Contact merchant, receive requirements]
You: "The merchant is requesting 54.39 USDC for a banana. Would you like to proceed with this payment?"

User: "yes"
You: [Sign and submit payment]
You: "✅ Payment successful! Your banana order has been confirmed!"`,

  tools: [
    sendMessageToMerchant,
    checkMerchantReputation,
    confirmPayment,
    cancelPayment,
    getWalletInfo,
  ],
});

// Export as root agent for ADK
export const rootAgent = clientAgent;
