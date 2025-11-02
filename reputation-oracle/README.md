# Reputation Scoring Oracle

A verifiable x402-enabled oracle that aggregates ENS history, on-chain transaction patterns, wallet age, and social graph data (Farcaster/Lens) into a single trust score (0-100) for agent counterparty risk assessment.

## 🎯 Overview

When Agent A wants to transact with Agent B, there's no way to know if B is trustworthy, malicious, or a Sybil. This oracle solves that by providing comprehensive reputation scoring.

**Key Features:**
- 🏛️ **ENS History Analysis** (20% weight)
- ⛓️ **On-chain Transaction Patterns** (30% weight)
- 📅 **Wallet Age Assessment** (15% weight)
- 🌐 **Social Graph Data** (35% weight) - Farcaster & Lens
- 💰 **x402 Payment Integration** - $0.50 USDC per query
- 🔒 **Verifiable Scoring** - Transparent, auditable reputation calculation

## 🚀 Quick Start

### Installation

```bash
cd reputation-oracle
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```env
RPC_URL=https://sepolia.base.org
PAYMENT_WALLET_ADDRESS=0xYourWalletAddress
PAYMENT_NETWORK=base-sepolia
QUERY_PRICE=0.50
PORT=3000
```

### Run

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## 📡 API Usage

### Query Reputation Score

```bash
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'
```

**Response (Payment Required):**
```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-sepolia",
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "payTo": "0xYourWalletAddress",
    "maxAmountRequired": "500000",
    "resource": "/reputation-query/0x...",
    "description": "Reputation scoring oracle query - $0.50 USDC",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 600
  }],
  "error": "Payment of $0.50 USDC required for reputation query"
}
```

**After Payment (Success):**
```json
{
  "success": true,
  "score": {
    "score": 78,
    "breakdown": {
      "ens": { "score": 65, "weight": 0.20, "factors": {...} },
      "onchain": { "score": 82, "weight": 0.30, "factors": {...} },
      "walletAge": { "score": 90, "weight": 0.15, "factors": {...} },
      "social": { "score": 72, "weight": 0.35, "factors": {...} }
    },
    "timestamp": 1234567890,
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "metadata": {
      "queryId": "1234567890-abc123",
      "queriedBy": "agent-123",
      "paymentTxHash": "0x...",
      "cached": false
    }
  },
  "message": "Reputation score calculated for 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

## 🏗️ Architecture

```
reputation-oracle/
├── src/
│   ├── api/
│   │   └── query.ts              # Main query endpoint
│   ├── scoring/
│   │   ├── aggregator.ts          # Combines all scores
│   │   ├── ens-scorer.ts          # ENS reputation (20%)
│   │   ├── onchain-scorer.ts      # On-chain patterns (30%)
│   │   ├── wallet-age-scorer.ts   # Wallet age (15%)
│   │   └── social-scorer.ts      # Social graphs (35%)
│   ├── data-sources/
│   │   ├── ens.ts                 # ENS data fetcher
│   │   ├── blockchain.ts          # On-chain data
│   │   ├── farcaster.ts           # Farcaster API
│   │   └── lens.ts                # Lens Protocol API
│   ├── x402/
│   │   └── payment-handler.ts     # x402 payment integration
│   ├── types/
│   │   └── reputation.ts          # TypeScript types
│   └── index.ts                   # Main server
├── package.json
├── tsconfig.json
└── README.md
```

## 📊 Scoring Breakdown

### ENS History (20% weight)
- Reverse resolution: +30 points
- Primary name: +20 points
- Account age: up to 20 points
- Linked addresses: up to 15 points
- Resolution stability: up to 15 points

### On-chain Patterns (30% weight)
- Transaction count: up to 25 points
- Unique counterparties: up to 20 points
- Total volume: up to 15 points
- Transaction frequency: up to 15 points
- Contract interactions: up to 15 points
- DApp diversity: up to 10 points

### Wallet Age (15% weight)
- New (< 90 days): 0-30 points
- Established (90-365 days): 30-70 points
- Veteran (365+ days): 70-100 points

### Social Graph (35% weight)
- **Farcaster** (50% of social):
  - Followers: up to 25 points
  - Verified: +15 points
  - Account age: up to 10 points
- **Lens** (50% of social):
  - Followers: up to 25 points
  - Verified: +15 points
  - Publications: up to 10 points

## 🔗 Integration with x402

The oracle uses the x402 payment protocol from `a2a-x402-typescript`:

1. **Payment Request**: Oracle returns payment requirements when queried
2. **Payment Verification**: Uses x402 facilitator to verify signatures
3. **Service Execution**: Calculates reputation score
4. **Payment Settlement**: Settles payment on-chain after successful query

### Example Integration (Agent Client)

```typescript
import { processPayment } from 'a2a-x402';
import { Wallet } from 'ethers';

const wallet = new Wallet(privateKey);

// 1. Query oracle (gets payment requirements)
const response = await fetch('http://oracle:3000/query', {
  method: 'POST',
  body: JSON.stringify({ address: '0x...' }),
});

const { accepts } = await response.json();

// 2. Sign payment
const paymentPayload = await processPayment(accepts[0], wallet);

// 3. Submit query with payment
const result = await fetch('http://oracle:3000/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: '0x...',
    paymentPayload,
  }),
});

const { score } = await result.json();

// 4. Check if score > 75 to proceed
if (score.score > 75) {
  // Proceed with transaction
}
```

## 🛠️ Development

### Project Structure

- **Data Sources**: Fetch raw data from various APIs/blockchain
- **Scorers**: Calculate component scores (0-100)
- **Aggregator**: Combines scores with weights
- **API**: Express server with x402 payment handling
- **Payment Handler**: x402 integration for payments

### TODO: Implementation Details

Each module has `TODO` comments indicating what needs to be implemented:
- ENS data fetching from ENS registry
- Blockchain transaction history parsing
- Farcaster/Lens API integration
- Scoring algorithm refinements
- Caching layer for performance
- Rate limiting and security

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `RPC_URL` | Ethereum RPC endpoint | Yes |
| `PAYMENT_WALLET_ADDRESS` | Wallet to receive payments | Yes |
| `PAYMENT_NETWORK` | Network for payments (base-sepolia, base, etc.) | Yes |
| `QUERY_PRICE` | Price per query in USD | No (default: 0.50) |
| `PORT` | Server port | No (default: 3000) |
| `FARCASTER_API_URL` | Farcaster API endpoint | No |
| `FARCASTER_API_KEY` | Farcaster API key | No |
| `LENS_API_URL` | Lens API endpoint | No |

## 🔐 Security

- Payment verification via x402 facilitator
- Address format validation
- Error handling and logging
- Rate limiting (TODO)
- Input sanitization (TODO)

## 📄 License

MIT

## 🙏 Acknowledgments

- [x402 Protocol](https://github.com/google-agentic-commerce/a2a-x402)
- [Agent0 SDK](https://sdk.ag0.xyz/)
- Built for the daydreamsagent x402 bounty

