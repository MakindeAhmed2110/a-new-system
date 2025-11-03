# x402 Payment Integration Guide

## ✅ Implementation Complete

The reputation oracle now uses the **x402 npm package** (`^0.7.0`) following the same pattern as the `x402-starter-kit`. All payment handling is implemented in `reputation-oracle/src/x402/MerchantExecutor.ts`.

## 🔑 Key Answer: Does Reputation Scoring Need AI for x402 Payments?

**NO** - x402 payment handling does NOT require AI. It's purely:
- **Payment verification logic** (EIP-712 signature verification)
- **Payment settlement logic** (EIP-3009 `transferWithAuthorization` calls)
- **Standard cryptographic operations** (no AI/LLM needed)

The reputation scoring itself is also **algorithmic** (not AI-based):
- Calculates scores from on-chain data
- Uses deterministic formulas
- No LLM or AI inference required

---

## 📋 How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Reputation Oracle (Express Server)                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MerchantExecutor (x402 Payment Handler)              │  │
│  │  - Creates payment requirements                       │  │
│  │  - Verifies payment signatures                        │  │
│  │  - Settles payments on-chain                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ API Endpoints (All x402-enabled)                      │  │
│  │  - POST /query ($0.01)                                │  │
│  │  - POST /activity ($0.01)                               │  │
│  │  - POST /feedback ($0.01)                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ x402 Facilitator (https://x402.org/facilitator)            │
│  - Verifies EIP-712 signatures                             │
│  - Executes transferWithAuthorization()                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Base Sepolia Network                                        │
│  - USDC Contract: 0x036CbD53842c5426634e7929541eC2318f3dCF7e │
│  - EIP-3009 transfers                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 💰 Payment Flow: Agent A Queries Agent B's Reputation

### Step-by-Step Flow

#### **Step 1: Agent A sends initial query (no payment)**

```bash
POST http://oracle:3000/query
Content-Type: application/json

{
  "agentId": "84532:123"  # Agent B's Agent0 ID
}
```

**Response (402 Payment Required):**
```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0xOracleWallet...",
    "maxAmountRequired": "10000",  // $0.01 USDC (10,000 micro units)
    "resource": "http://oracle:3000/query",
    "description": "Reputation scoring oracle query",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 600,
    "extra": {
      "name": "USDC",
      "version": "2"
    }
  }],
  "error": "Payment required for service"
}
```

#### **Step 2: Agent A signs payment using x402 package**

Agent A uses the `x402` npm package:

```typescript
import { Wallet } from 'ethers';
import type { PaymentRequirements } from 'x402/types';

const wallet = new Wallet(agentAPrivateKey);

// Create EIP-712 domain
const domain = {
  name: 'USDC',
  version: '2',
  chainId: 84532,  // Base Sepolia
  verifyingContract: paymentReq.asset,
};

// Create authorization
const authorization = {
  from: wallet.address,
  to: paymentReq.payTo,
  value: paymentReq.maxAmountRequired,
  validAfter: '0',
  validBefore: String(Math.floor(Date.now()/1000) + 600),
  nonce: `0x${randomBytes(32).toString('hex')}`,
};

// Sign typed data (EIP-712)
const TRANSFER_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

const signature = await wallet.signTypedData(
  domain,
  TRANSFER_AUTH_TYPES,
  authorization
);

// Create payment payload
const paymentPayload = {
  x402Version: 1,
  scheme: 'exact',
  network: 'base-sepolia',
  payload: {
    authorization,
    signature,
  },
};
```

#### **Step 3: Agent A resubmits with payment (A2A format)**

```bash
POST http://oracle:3000/query
Content-Type: application/json

{
  "message": {
    "messageId": "msg-123",
    "role": "user",
    "parts": [
      {
        "kind": "text",
        "text": "{\"agentId\":\"84532:123\"}"
      }
    ],
    "metadata": {
      "x402.payment.payload": {
        "x402Version": 1,
        "scheme": "exact",
        "network": "base-sepolia",
        "payload": {
          "authorization": { ... },
          "signature": "0x..."
        }
      },
      "x402.payment.status": "payment-submitted"
    }
  }
}
```

#### **Step 4: Oracle processes payment**

1. **Extracts payment** from `message.metadata['x402.payment.payload']`
2. **Verifies signature** using `MerchantExecutor.verifyPayment()`
   - Validates EIP-712 signature
   - Checks amount, timestamps, nonce
   - Confirms network matches
3. **Resolves Agent0 ID** → wallet address via Agent0 SDK
4. **Calculates reputation score** using:
   - ENS data (20% weight)
   - On-chain patterns (30% weight)
   - Wallet age (15% weight)
   - Social graphs (35% weight)
5. **Settles payment** using `MerchantExecutor.settlePayment()`
   - Calls facilitator or directly calls `transferWithAuthorization()`
   - Transfers 10,000 USDC from Agent A → Oracle

#### **Step 5: Oracle returns reputation data**

```json
{
  "success": true,
  "score": {
    "score": 76.9,
    "breakdown": {
      "ens": { "score": 75, "weight": 0.20 },
      "onchain": { "score": 82, "weight": 0.30 },
      "walletAge": { "score": 90, "weight": 0.15 },
      "social": { "score": 68, "weight": 0.35 }
    },
    "address": "0xAgentB...",
    "timestamp": 1234567890
  },
  "agent0": {
    "agentId": "84532:123",
    "name": "Agent B",
    "walletAddress": "0xAgentB...",
    "x402support": true
  },
  "settlement": {
    "success": true,
    "transaction": "0xabc123...",
    "network": "base-sepolia",
    "payer": "0xAgentA..."
  }
}
```

#### **Step 6: Agent A decides whether to transact**

```typescript
if (reputationScore.score >= 70) {
  // Agent B is trustworthy, proceed
  proceedWithTransaction(agentB);
} else {
  // Agent B has low reputation, abort
  abort("Reputation too low");
}
```

---

## 📡 All API Endpoints

### 1. **POST /query** (Paid - $0.01)

Get reputation score for an agent or wallet address.

**Request (Simple JSON):**
```json
{
  "agentId": "84532:123",
  "address": "0x...",  // Optional (use agentId OR address)
  "requesterAddress": "0x..."  // Optional
}
```

**Request (A2A Format):**
```json
{
  "message": {
    "parts": [{"kind": "text", "text": "..."}],
    "metadata": {
      "x402.payment.payload": {...},
      "x402.payment.status": "payment-submitted"
    }
  }
}
```

---

### 2. **POST /activity** (Paid - $0.01)

Register agent on-chain activity.

**Request:**
```json
{
  "agentId": "84532:123",
  "activity": {
    "type": "transaction",
    "data": {
      "txHash": "0x...",
      "counterparty": "0x...",
      "amount": "1000000"
    }
  },
  "signature": "0x..."
}
```

**Payment:** Required via x402 (same flow as query)

---

### 3. **POST /feedback** (Paid - $0.01)

Submit feedback about an agent via Agent0 SDK.

**Request:**
```json
{
  "targetAgentId": "84532:123",
  "score": 85,
  "tags": ["reliable", "fast"]
}
```

**Payment:** Required via x402 (same flow as query)

---

### 4. **GET /activity/:agentId** (Free)

Get all registered activities for an agent.

---

### 5. **GET /agent/:agentId/info** (Free)

Get comprehensive agent information (Agent0 + reputation).

---

## 🔧 Configuration

### Required Environment Variables

```bash
# Server
PORT=3000
RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
PAYMENT_WALLET_ADDRESS=0xYourOracleWallet
PAYMENT_NETWORK=base-sepolia

# Prices (in USD)
QUERY_PRICE=0.01        # $0.01 per query
ACTIVITY_PRICE=0.01    # $0.01 per activity registration
FEEDBACK_PRICE=0.01    # $0.01 per feedback

# Settlement (optional)
SETTLEMENT_MODE=direct  # 'direct' or 'facilitator' (default: facilitator)
PRIVATE_KEY=0xYourPrivateKey  # Required for direct settlement
FACILITATOR_URL=https://x402.org/facilitator  # Default facilitator
FACILITATOR_API_KEY=your_key  # Optional

# Service URL (optional)
SERVICE_URL=http://your-oracle-domain.com  # Public URL for payment requirements

# Agent0 (optional - for oracle registration)
AGENT0_PRIVATE_KEY=0x...
AGENT0_AGENT_URL=http://your-oracle-domain.com
AGENT0_RPC_URL=https://...
IPFS_API_URL=https://...
```

---

## 🎯 Settlement Modes

### **Facilitator Mode (Default)**

- Uses `https://x402.org/facilitator`
- Oracle sends payment payload to facilitator
- Facilitator verifies and settles on-chain
- No private key needed on oracle

### **Direct Mode (Local Settlement)**

- Set `SETTLEMENT_MODE=local` and provide `PRIVATE_KEY`
- Oracle verifies signature locally
- Oracle directly calls `transferWithAuthorization()` on USDC contract
- Requires oracle wallet to have gas (ETH)
- Faster (no external API call)

---

## 📚 How Agents Use the Oracle

### Example: Agent Client Code

```typescript
import { Wallet } from 'ethers';
import type { PaymentRequirements } from 'x402/types';

class ReputationOracleClient {
  private oracleUrl = 'http://oracle:3000';
  private wallet: Wallet;

  async queryReputation(agentId: string) {
    // Step 1: Initial request (gets payment requirements)
    const response = await fetch(`${this.oracleUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId })
    });

    if (response.status !== 402) {
      // Payment already included or error
      return await response.json();
    }

    // Step 2: Get payment requirements
    const paymentReqs = await response.json();
    
    // Step 3: Sign payment
    const paymentPayload = await this.signPayment(paymentReqs.accepts[0]);

    // Step 4: Resubmit with payment (A2A format)
    const finalResponse = await fetch(`${this.oracleUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          messageId: `msg-${Date.now()}`,
          role: 'user',
          parts: [{ kind: 'text', text: JSON.stringify({ agentId }) }],
          metadata: {
            'x402.payment.payload': paymentPayload,
            'x402.payment.status': 'payment-submitted'
          }
        }
      })
    });

    return await finalResponse.json();
  }

  private async signPayment(requirements: PaymentRequirements) {
    // Implementation using ethers.js (same as starter kit pattern)
    // ... create authorization and sign ...
  }
}
```

---

## ✅ What's Implemented

- ✅ **MerchantExecutor** class (based on starter kit)
- ✅ **Query endpoint** with x402 payment ($0.01)
- ✅ **Activity registration** with x402 payment ($0.01)
- ✅ **Feedback submission** with x402 payment ($0.01)
- ✅ **A2A message format** support
- ✅ **Simple JSON format** support (backward compatible)
- ✅ **Agent0 ID resolution** to wallet addresses
- ✅ **Facilitator and direct settlement** modes
- ✅ **Payment verification** (EIP-712 signature validation)
- ✅ **Payment settlement** (EIP-3009 transfers)

---

## 🚀 Ready to Use

The oracle is now fully integrated with x402 payments. Agents can:
1. Query reputation scores for $0.01
2. Register activities for $0.01
3. Submit feedback for $0.01
4. Fetch agent information for free
5. Search agents for free

**No AI is required** - all payment handling is pure cryptographic verification and blockchain transaction logic.

