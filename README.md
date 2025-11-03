# A New System

A comprehensive agent-to-agent (A2A) payment and reputation system built on the x402 payment protocol. This repository contains the TypeScript implementation of the x402 payment protocol, example agents, and a reputation scoring oracle.

## 📦 Project Structure

```
.
├── a2a-x402-typescript/          # x402 payment protocol implementation
│   ├── x402_a2a/                 # Core library package
│   ├── client-agent/              # Example client agent with wallet integration
│   └── merchant-agent/            # Example merchant agent with payment handling
└── reputation-oracle/             # Reputation scoring oracle service
```

## 🚀 Quick Start

### x402 Payment Protocol Library

The core TypeScript implementation of the x402 payment protocol for agent-to-agent cryptocurrency payments.

**Installation:**
```bash
cd a2a-x402-typescript/x402_a2a
npm install
```

See the [a2a-x402-typescript README](a2a-x402-typescript/README.md) for detailed documentation.

### Client Agent

An orchestrator agent that can interact with merchant agents and handle x402 payment flows using cryptocurrency.

**Quick Start:**
```bash
cd a2a-x402-typescript/client-agent
npm install
cp .env.example .env
# Edit .env with your API keys and wallet
npm run dev
```

See the [client-agent README](a2a-x402-typescript/client-agent/README.md) for details.

### Merchant Agent

A service provider agent that requests payments, verifies signatures, and settles transactions using the x402 protocol.

**Quick Start:**
```bash
cd a2a-x402-typescript/merchant-agent
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

See the [merchant-agent README](a2a-x402-typescript/merchant-agent/README.md) for details.

### Reputation Oracle

A verifiable x402-enabled oracle that aggregates ENS history, on-chain transaction patterns, wallet age, and social graph data (Farcaster/Lens) into a single trust score (0-100) for agent counterparty risk assessment.

**Quick Start:**
```bash
cd reputation-oracle
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

**Architecture Overview:**
```
Agent A → Oracle API → x402 Payment → Data Fetching → Scoring → Response
                              ↓
                    ┌─────────────────┐
                    │ Score Components │
                    ├─────────────────┤
                    │ ENS (20%)       │
                    │ On-Chain (30%)  │
                    │ Wallet Age (15%)│
                    │ Social (35%)    │
                    └─────────────────┘
                              ↓
                    Weighted Aggregation
                              ↓
                    Final Score (0-100)
```

**How It Works:**
1. Agent requests reputation for an address/agent ID
2. Oracle requires x402 payment ($0.01 USDC)
3. Agent signs EIP-3009 `transferWithAuthorization`
4. Oracle verifies payment and fetches data from:
   - ENS registry (identity verification)
   - Blockchain RPC (transaction history)
   - Farcaster API (social graph)
   - Lens API (social graph)
5. Oracle calculates weighted scores:
   - **ENS History (20%)**: Reverse resolution, primary name, account age, linked addresses
   - **On-Chain Patterns (30%)**: Transaction count, volume, counterparties, DApp usage
   - **Wallet Age (15%)**: Account tenure (new/established/veteran)
   - **Social Graph (35%)**: Farcaster + Lens followers, verification, activity
6. Oracle returns score with detailed breakdown
7. Payment is settled on-chain

**Example Response:**
```json
{
  "success": true,
  "score": {
    "score": 78,
    "breakdown": {
      "ens": { "score": 65, "weight": 0.20 },
      "onchain": { "score": 82, "weight": 0.30 },
      "walletAge": { "score": 90, "weight": 0.15 },
      "social": { "score": 72, "weight": 0.35 }
    }
  }
}
```

**Score Interpretation:**
- **0-25**: New/untrusted (proceed with extreme caution)
- **26-50**: Low reputation (require additional verification)
- **51-75**: Moderate reputation (standard precautions)
- **76-100**: High reputation (generally trustworthy)

#### 🚂 Railway Deployment

**Quick Deploy to Railway:**

1. **Push to GitHub** (if not already)
   ```bash
   cd reputation-oracle
   git init && git add . && git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/reputation-oracle.git
   git push -u origin main
   ```

2. **Create Railway Project**
   - Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
   - Select your repository

3. **Configure Environment Variables** (in Railway dashboard → Variables)
   ```bash
   RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
   PAYMENT_WALLET_ADDRESS=0xYourWalletAddress
   PAYMENT_NETWORK=base
   SERVICE_URL=https://your-app-name.up.railway.app
   SETTLEMENT_MODE=facilitator
   FACILITATOR_URL=https://x402.org/facilitator
   ```

4. **Get Your URL**
   - Railway provides: `https://your-app-name.up.railway.app`
   - Update `SERVICE_URL` with this URL

5. **Verify Deployment**
   ```bash
   curl https://your-app-name.up.railway.app/health
   ```

#### 💰 x402 Payment Integration

The oracle uses x402 micropayments ($0.01 USDC per query). Payment flow:

1. **Agent sends query** → Oracle returns 402 with payment requirements
2. **Agent signs payment** → EIP-3009 `transferWithAuthorization` signature
3. **Agent resubmits** → With payment payload in request metadata
4. **Oracle verifies** → Cryptographically verifies signature
5. **Oracle calculates** → Fetches data and computes reputation score
6. **Oracle settles** → Payment settled on-chain (via facilitator or direct)

**Settlement Modes:**
- **Facilitator** (default): Uses x402.org facilitator - no gas costs for oracle
- **Direct**: Oracle settles directly - requires gas (ETH) on oracle wallet

#### 🤖 How Agents Use the Oracle

**Using `a2a-x402` package (Recommended):**

```typescript
import { processPayment } from 'a2a-x402';
import { Wallet } from 'ethers';

const REPUTATION_ORACLE_URL = 'https://your-oracle.up.railway.app';

async function queryReputation(address: string, wallet: Wallet) {
  // Step 1: Initial request (gets payment requirements)
  const response = await fetch(`${REPUTATION_ORACLE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });

  if (response.status === 402) {
    // Step 2: Get payment requirements
    const paymentReq = await response.json();
    
    // Step 3: Sign payment using a2a-x402
    const paymentPayload = await processPayment(
      paymentReq.accepts[0],
      wallet
    );

    // Step 4: Submit with payment (A2A format)
    const paidResponse = await fetch(`${REPUTATION_ORACLE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          messageId: `msg-${Date.now()}`,
          role: 'user',
          parts: [{ kind: 'text', text: JSON.stringify({ address }) }],
          metadata: {
            'x402.payment.payload': paymentPayload,
            'x402.payment.status': 'payment-submitted',
          },
        },
      }),
    });

    const result = await paidResponse.json();
    return result.score; // Contains score, breakdown, and settlement info
  }

  return await response.json();
}

// Usage in agent
const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY!);
const reputation = await queryReputation('0x742d35Cc...', wallet);
console.log(`Reputation: ${reputation.score}/100`);
```

#### 📡 API Endpoints

**Paid Endpoints ($0.01 USDC):**
- `POST /query` - Get reputation score for address/agentId
- `POST /activity` - Register agent activity
- `POST /feedback` - Submit feedback about an agent

**Free Endpoints:**
- `GET /health` - Health check
- `GET /agent/:agentId/info` - Get agent information
- `GET /agent/:agentId/feedback` - Get feedback summary
- `GET /agents/search` - Search for agents

**Example Query:**
```bash
curl -X POST https://your-app.up.railway.app/query \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

See the [reputation-oracle README](reputation-oracle/README.md) for detailed documentation, architecture diagrams, and scoring algorithms.

## 🎯 Features

### x402 Payment Protocol
- **Exception-based payment flow** - Throw exceptions to request payments dynamically
- **Full TypeScript support** - Complete type definitions and interfaces
- **Ethereum wallet integration** - Built on ethers.js for signing and verification
- **Dynamic pricing** - Set prices based on request parameters
- **Multi-network support** - Works with Base, Base Sepolia, and other EVM chains
- **ERC-20 token payments** - Native support for USDC and other tokens

### Reputation Oracle
- **Comprehensive scoring** - Aggregates multiple data sources into a single trust score (0-100)
- **ENS history analysis** (20% weight) - Identity verification, account age, linked addresses
- **On-chain transaction patterns** (30% weight) - Volume, frequency, counterparties, DApp diversity
- **Wallet age assessment** (15% weight) - Account tenure classification (new/established/veteran)
- **Social graph data** (35% weight) - Farcaster & Lens followers, verification, activity
- **x402 payment integration** - $0.01 USDC per query with automatic settlement
- **Agent0 integration** - Discoverable in Agent0 registry, supports feedback system
- **RESTful API** - Paid query endpoint + free agent info endpoints
- **Parallel data fetching** - Efficient multi-source data aggregation

## 🔗 Components Overview

### x402_a2a Library

The core library package that can be published to npm. Provides:
- Payment requirement creation and validation
- Wallet integration for signing payments
- Protocol verification and settlement
- State management for payment flows
- Abstract executor classes for building agents

### Client Agent

An example implementation showing how to:
- Connect to merchant agents
- Handle payment requirements
- Sign payments with a wallet
- Process USDC payments on Base Sepolia

### Merchant Agent

An example implementation showing how to:
- Request payments dynamically
- Verify payment signatures
- Settle transactions on-chain
- Integrate with facilitator services

### Reputation Oracle

A production-ready service that:
- **Fetches data from multiple sources** - ENS registry, blockchain RPC nodes, Farcaster API, Lens API
- **Calculates weighted reputation scores** - Four component scores aggregated with configurable weights
- **Integrates with x402** - Paid queries with automatic payment verification and settlement
- **Agent0 integration** - Register as discoverable agent, submit/retrieve feedback
- **RESTful API** - Main query endpoint (`POST /query`) plus activity and feedback endpoints
- **Comprehensive scoring** - Deterministic, transparent algorithms for each component
- **Works with untracked agents** - Returns low scores (0) for new addresses with no history

**Use Cases:**
- Agent A wants to check Agent B's trustworthiness before transacting
- Risk assessment for counterparty in agent-to-agent transactions
- Sybil detection through multi-factor reputation analysis
- Trust scoring for agent discovery and selection

## 📚 Documentation

- [x402 Protocol Documentation](a2a-x402-typescript/README.md)
- [Client Agent Guide](a2a-x402-typescript/client-agent/README.md)
- [Merchant Agent Guide](a2a-x402-typescript/merchant-agent/README.md)
- [Reputation Oracle Guide](reputation-oracle/README.md)

## 🛠️ Development

Each component has its own development setup and scripts. Refer to the individual README files for:
- Installation instructions
- Environment configuration
- Development commands
- Testing procedures
- Deployment guides

## 🔐 Security

**Important Security Notes:**
- Never commit `.env` files or private keys to version control
- Use separate wallets for testnet and mainnet
- Keep minimal balances in hot wallets
- Consider hardware wallets for production
- Always use HTTPS in production

## 🌐 Supported Networks

The system supports multiple EVM-compatible networks:
- **Base Sepolia** (testnet)
- **Base** (mainnet)
- **Ethereum** (mainnet)
- **Polygon** and **Polygon Amoy** (testnet)

## 📝 License

Apache-2.0 - See individual component licenses for details.

## 🤝 Contributing

Contributions welcome! Each component can be developed independently. Please refer to the individual component documentation for contribution guidelines.

## 🔗 Related Projects

- [ADK TypeScript](https://github.com/njraladdin/adk-typescript) - Agent Development Kit for TypeScript
- [Python x402 implementation](https://github.com/google-agentic-commerce/a2a-x402) - Original protocol specification

