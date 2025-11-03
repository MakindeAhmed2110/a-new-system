# Integrating Reputation Oracle API

This guide shows how to use the Reputation Scoring Oracle API in your a2a-x402 agents.

## Quick Start

### 1. Deploy Reputation Oracle on Railway

Follow the instructions in `reputation-oracle/RAILWAY.md` to deploy the API.

After deployment, you'll get a URL like:
```
https://reputation-oracle-production.up.railway.app
```

### 2. Configure Your Agent

Add to your `.env` file in `client-agent` or `merchant-agent`:

```bash
REPUTATION_ORACLE_URL=https://your-app.up.railway.app
```

### 3. Use the Integration Example

Copy functions from `reputation-api-example.ts` into your agent:

```typescript
import { queryReputation } from './reputation-api-example';
import { Wallet } from 'ethers';

// In your agent tool
async function checkAgentReputation(
  params: { address: string },
  context?: ToolContext
): Promise<string> {
  const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY!);
  
  const reputation = await queryReputation(params.address, wallet);
  
  return `Agent reputation: ${reputation.score}/100`;
}
```

## API Endpoints

### Paid Endpoints ($0.01 USDC each)

#### POST `/query` - Get Reputation Score
```typescript
const response = await fetch(`${REPUTATION_ORACLE_URL}/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    // OR
    agentId: '84532:123'
  })
});

// First request returns 402 with payment requirements
// Include signed payment in 'x402-payment-payload' header on retry
```

**Response:**
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
    },
    "timestamp": 1234567890
  },
  "settlement": {
    "success": true,
    "transaction": "0xabc..."
  }
}
```

#### POST `/feedback` - Submit Feedback
```typescript
const response = await fetch(`${REPUTATION_ORACLE_URL}/feedback`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agentId: '84532:123',
    score: 85,
    tags: ['helpful', 'reliable']
  })
});
```

### Free Endpoints

#### GET `/agent/:agentId/info` - Get Agent Information
```typescript
const response = await fetch(`${REPUTATION_ORACLE_URL}/agent/84532:123/info`);
const agentInfo = await response.json();
```

#### GET `/agent/:agentId/feedback` - Get Feedback Summary
```typescript
const response = await fetch(`${REPUTATION_ORACLE_URL}/agent/84532:123/feedback`);
const feedback = await response.json();
```

#### GET `/health` - Health Check
```typescript
const response = await fetch(`${REPUTATION_ORACLE_URL}/health`);
const health = await response.json();
```

## Payment Flow

The integration example (`reputation-api-example.ts`) handles the x402 payment flow automatically:

1. **First Request**: API returns `402 Payment Required` with payment details
2. **Sign Payment**: Use `processPayment()` from `a2a-x402` to sign the authorization
3. **Retry with Payment**: Include signed payment in `x402-payment-payload` header
4. **Receive Response**: API verifies payment and returns the result
5. **Settlement**: Payment is settled on-chain (included in response)

## Example: Adding Reputation Check Tool to Client Agent

Add this to `client-agent/agent.ts`:

```typescript
import { queryReputation } from '../reputation-api-example';
import { Wallet } from 'ethers';

// Add to tools array
{
  name: 'check_reputation',
  description: 'Check the reputation score of a wallet address or agent. Returns a score from 0-100 based on ENS data, on-chain activity, wallet age, and social profiles.',
  parameters: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Ethereum wallet address (0x...) or Agent0 ID (chainId:tokenId)',
      },
    },
    required: ['address'],
  },
  handler: async (params: { address: string }) => {
    const wallet = new Wallet(process.env.WALLET_PRIVATE_KEY!);
    const reputation = await queryReputation(params.address, wallet);
    
    return `Reputation Score: ${reputation.score}/100

Breakdown:
- ENS: ${reputation.breakdown.ens.score}/100 (20% weight)
- On-Chain Activity: ${reputation.breakdown.onchain.score}/100 (30% weight)
- Wallet Age: ${reputation.breakdown.walletAge.score}/100 (15% weight)
- Social Profiles: ${reputation.breakdown.social.score}/100 (35% weight)

Trust Level: ${
  reputation.score >= 70 ? 'Highly Trusted ✅' :
  reputation.score >= 50 ? 'Moderately Trusted ⚠️' :
  'Low Trust ❌'
}`;
  },
}
```

## Testing

1. **Health Check**
```bash
curl https://your-app.up.railway.app/health
```

2. **Query (will require payment)**
```bash
curl -X POST https://your-app.up.railway.app/query \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

3. **In Agent**
```
User: Check the reputation of 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Agent: [Agent will handle payment and return reputation score]
```

## Troubleshooting

### Connection Issues
- Verify `REPUTATION_ORACLE_URL` is set correctly
- Check Railway deployment is running
- Test health endpoint first

### Payment Issues
- Ensure wallet has USDC balance
- Check USDC approval if needed
- Verify network matches (base-sepolia)

### API Errors
- Check Railway logs: `railway logs`
- Verify all environment variables are set
- Ensure RPC URL is accessible

