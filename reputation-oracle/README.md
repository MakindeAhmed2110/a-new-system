# Reputation Scoring Oracle ( A New System )

A verifiable x402-enabled oracle that aggregates ENS history, on-chain transaction patterns, wallet age, and social graph data (Farcaster/Lens) into a single trust score (0-100) for agent counterparty risk assessment.

## 🎯 Overview

When Agent A wants to transact with Agent B, there's no way to know if B is trustworthy, malicious, or a Sybil. This oracle solves that by providing comprehensive reputation scoring.

**Key Features:**
- 🏛️ **ENS History Analysis** (20% weight)
- ⛓️ **On-chain Transaction Patterns** (30% weight)
- 📅 **Wallet Age Assessment** (15% weight)
- 🌐 **Social Graph Data** (35% weight) - Farcaster & Lens
- 💰 **x402 Payment Integration** - $0.01 USDC per query
- 🔒 **Verifiable Scoring** - Transparent, auditable reputation calculation
- 🤖 **Agent0 Integration** - Discoverable in Agent0 registry

---

## 🏗️ Architecture

### System Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REPUTATION SCORING ORACLE                          │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      Express HTTP Server                              │  │
│  │  ┌──────────────────────────────────────────────────────────────┐    │  │
│  │  │  API Endpoints (x402-protected)                               │    │  │
│  │  │  • POST /query        - Reputation score queries              │    │  │
│  │  │  • POST /activity     - Agent activity registration           │    │  │
│  │  │  • POST /feedback     - Feedback submission                   │    │  │
│  │  │  • GET  /health       - Health check                           │    │  │
│  │  └──────────────────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    x402 Payment Handler                              │  │
│  │  • Verify EIP-3009 transferWithAuthorization signatures              │  │
│  │  • Settle payments (facilitator or direct on-chain)                 │  │
│  │  • Return payment requirements (402 status)                          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                   Reputation Score Aggregator                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │  │
│  │  │ ENS Scorer   │  │On-Chain      │  │Wallet Age    │            │  │
│  │  │ (20% weight) │  │Scorer        │  │Scorer        │            │  │
│  │  │              │  │(30% weight)  │  │(15% weight)  │            │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │  │
│  │         │                  │                  │                     │  │
│  │         └──────────────────┴──────────────────┘                     │  │
│  │                                    │                                  │  │
│  │                                    ▼                                  │  │
│  │                        Weighted Average Calculation                 │  │
│  │                        Final Score (0-100)                          │  │
│  │                                    │                                  │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ Social Scorer (35% weight)                                    │  │  │
│  │  │ • Farcaster (50%) + Lens (50%)                                │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      Data Sources (Parallel Fetch)                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │  │
│  │  │ ENS         │  │ Blockchain  │  │ Farcaster   │  │ Lens     │ │  │
│  │  │ Registry    │  │ RPC Node    │  │ API         │  │ API      │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │ Agent0 SDK                                                    │  │  │
│  │  │ • Agent registry queries                                      │  │  │
│  │  │ • Feedback submission                                          │  │  │
│  │  │ • Agent info retrieval                                         │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Request Flow Diagram

```
┌─────────────┐
│  Agent A    │  Wants to check Agent B's reputation
└──────┬──────┘
       │
       │ 1. POST /query
       │    { "address": "0xBBB..." }
       ▼
┌─────────────────────────────────────┐
│  Reputation Oracle API              │
└──────┬──────────────────────────────┘
       │
       │ 2. Check for x402 payment
       │
       ▼
┌─────────────────────────────────────┐
│  No Payment? → Return 402            │
│  { "accepts": [{                    │
│      "network": "base-sepolia",     │
│      "asset": "0x036C...",          │
│      "maxAmountRequired": "10000",  │  ← $0.01 USDC
│      "payTo": "0xOracle..."         │
│  }] }                                │
└─────────────────────────────────────┘
       │
       │ 3. Agent A signs EIP-3009 authorization
       │    Resubmits with payment payload
       │
       ▼
┌─────────────────────────────────────┐
│  Verify Payment Signature            │
│  • EIP-712 signature verification   │
│  • Check authorization validity      │
└──────┬──────────────────────────────┘
       │
       │ 4. Payment verified ✅
       │
       ▼
┌─────────────────────────────────────┐
│  Parallel Data Fetching             │
│  ┌──────────┐ ┌──────────┐         │
│  │ ENS Data │ │On-Chain  │         │
│  └──────────┘ │History   │         │
│               └──────────┘         │
│  ┌──────────┐ ┌──────────┐         │
│  │Wallet Age│ │Social    │         │
│  └──────────┘ │Profiles  │         │
│               └──────────┘         │
└──────┬──────────────────────────────┘
       │
       │ 5. Calculate component scores
       │
       ▼
┌─────────────────────────────────────┐
│  Score Aggregation                   │
│  Final Score =                       │
│    ENS(20%) + OnChain(30%) +         │
│    WalletAge(15%) + Social(35%)      │
└──────┬──────────────────────────────┘
       │
       │ 6. Settle payment on-chain
       │
       ▼
┌─────────────────────────────────────┐
│  Return Response                     │
│  {                                   │
│    "score": 78,                      │
│    "breakdown": { ... },             │
│    "settlement": {                   │
│      "transaction": "0xabc..."      │
│    }                                 │
│  }                                   │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Agent A    │  Makes decision based on score
└─────────────┘
```

---

## 📊 Reputation Scoring Explained

### How It Works

The reputation score is a weighted combination of four component scores, each ranging from 0-100:

```
Final Score = (ENS × 0.20) + (OnChain × 0.30) + (WalletAge × 0.15) + (Social × 0.35)
```

### Component Scoring Details

#### 1. ENS History (20% weight)

**What it measures:** Identity verification and account legitimacy through Ethereum Name Service.

**Scoring Factors:**
- **Reverse Resolution** (+30 points): Address has a reverse ENS record
  - Indicates intentional identity setup
  - Shows commitment to being discoverable
- **Primary Name** (+20 points): Address has a primary ENS name
  - Professional setup
  - Easier to identify and remember
- **Account Age** (up to 20 points): Based on ENS registration date
  - Older registrations = more trusted
  - Formula: `min(20, (daysSinceRegistration / 365) * 10)`
- **Linked Addresses** (up to 15 points): Multiple addresses linked to same ENS
  - Shows account management
  - Formula: `min(15, linkedAddressCount * 3)`
- **Resolution Stability** (up to 15 points): Fewer changes = better
  - Formula: `max(0, 15 - resolutionHistoryCount * 2)`

**Example Calculation:**
```
Address has: Reverse resolution ✅, Primary name ✅, 2 years old, 3 linked addresses, stable
Score = 30 + 20 + 20 + 15 + 15 = 100/100 (max)
Final contribution = 100 × 0.20 = 20.0 points
```

#### 2. On-Chain Patterns (30% weight)

**What it measures:** Transaction history, volume, diversity, and network participation.

**Scoring Factors:**
- **Transaction Count** (up to 25 points): Logarithmic scale
  - More activity = better, but with diminishing returns
  - Formula: `min(25, log10(transactionCount + 1) * 8)`
- **Unique Counterparties** (up to 20 points): Number of unique addresses interacted with
  - Higher diversity = more legitimate
  - Formula: `min(20, min(counterparties / 10, 1) * 20)`
- **Total Volume** (up to 15 points): Logarithmic scale of transaction volume
  - Normalized to ETH equivalent
  - Formula: `min(15, log10(volumeETH + 1) * 5)`
- **Transaction Frequency** (up to 15 points): Consistent activity
  - Ideal: 10-50 transactions per month
  - Formula: `min(15, min(frequency / 10, 1) * 15)`
- **Contract Interactions** (up to 15 points): Protocol/DApp usage
  - Shows DeFi participation
  - Formula: `min(15, contractInteractions * 3)`
- **DApp Diversity** (up to 10 points): Unique protocols used
  - More protocols = more established user
  - Formula: `min(10, dappDiversity * 2)`

**Example Calculation:**
```
Address has: 100 transactions, 25 counterparties, $50k volume, 20/month frequency, 5 protocols
Transaction Count: log10(101) * 8 = 16.08 → 16 points
Counterparties: min(25/10, 1) * 20 = 20 points
Volume: log10(16.67) * 5 = 6.03 → 6 points
Frequency: min(20/10, 1) * 15 = 15 points
Contracts: 5 * 3 = 15 points
DApp Diversity: 5 * 2 = 10 points
Total = 82/100
Final contribution = 82 × 0.30 = 24.6 points
```

#### 3. Wallet Age (15% weight)

**What it measures:** Account tenure and historical presence.

**Scoring Logic:**
- **New** (< 90 days): 0-30 points
  - Formula: `(ageInDays / 90) * 30`
- **Established** (90-365 days): 30-70 points
  - Linear progression from 30 to 70
  - Formula: `30 + ((ageInDays - 90) / 275) * 40`
- **Veteran** (365+ days): 70-100 points
  - Max out after 2 years (730 days)
  - Formula: `70 + min(1, (ageInDays - 365) / 365) * 30`

**Example Calculation:**
```
Wallet age: 450 days (Established tier)
Days in tier: 450 - 90 = 360
Tier range: 365 - 90 = 275 days
Progress: 360 / 275 = 1.31 (clamped to 1.0)
Score = 30 + (1.0 * 40) = 70/100
Final contribution = 70 × 0.15 = 10.5 points
```

#### 4. Social Graph (35% weight)

**What it measures:** Social presence and verification on Farcaster and Lens.

**Farcaster Scoring (50% of social score):**
- **Followers** (up to 25 points): Logarithmic scale
  - Formula: `min(25, log10(followers + 1) * 8)`
- **Verified Badge** (+15 points): Platform verification
- **Account Age** (up to 10 points): Based on registration date
  - Formula: `min(10, (ageInDays / 365) * 10)`

**Lens Scoring (50% of social score):**
- **Followers** (up to 25 points): Logarithmic scale
  - Formula: `min(25, log10(followers + 1) * 8)`
- **Verified Badge** (+15 points): Platform verification
- **Publications** (up to 10 points): Content activity
  - Formula: `min(10, log10(publications + 1) * 5)`

**Combined Social Score:**
```
Social Score = (Farcaster Score × 0.5) + (Lens Score × 0.5)
```

**Example Calculation:**
```
Farcaster: 1,000 followers, verified ✅, 2 years old
  Followers: log10(1001) * 8 = 24.0 points
  Verified: 15 points
  Age: min(10, (730/365) * 10) = 10 points
  Farcaster Score = 49/100

Lens: 500 followers, verified ✅, 50 publications
  Followers: log10(501) * 8 = 22.0 points
  Verified: 15 points
  Publications: log10(51) * 5 = 8.5 points
  Lens Score = 45.5/100

Social Score = (49 × 0.5) + (45.5 × 0.5) = 47.25/100
Final contribution = 47.25 × 0.35 = 16.54 points
```

### Complete Example: Final Score Calculation

**Address Profile:**
- ENS: Has reverse resolution, primary name, 2 years old, 3 linked addresses, stable → **100/100**
- On-Chain: 100 transactions, 25 counterparties, $50k volume, active → **82/100**
- Wallet Age: 450 days (Established) → **70/100**
- Social: Strong Farcaster, moderate Lens → **47/100**

**Final Score:**
```
(100 × 0.20) + (82 × 0.30) + (70 × 0.15) + (47 × 0.35)
= 20.0 + 24.6 + 10.5 + 16.45
= 71.55 → 72/100
```

**Score Interpretation:**
- **0-25**: New/untrusted address (proceed with extreme caution)
- **26-50**: Low reputation (require additional verification)
- **51-75**: Moderate reputation (standard precautions)
- **76-100**: High reputation (generally trustworthy)

---

## 💻 Codebase Structure

### Directory Overview

```
reputation-oracle/
├── src/
│   ├── agent0/                    # Agent0 SDK integration
│   │   ├── registration.ts       # On-chain agent registration (ERC-8004)
│   │   ├── data-fetcher.ts       # Query Agent0 registry for agent info
│   │   └── feedback-client.ts    # Submit/retrieve feedback via Agent0
│   │
│   ├── api/                       # Express.js API endpoints
│   │   ├── query.ts              # Main reputation query endpoint (paid)
│   │   ├── activity.ts           # Activity registration endpoint (paid)
│   │   ├── feedback.ts           # Feedback submission endpoint (paid)
│   │   └── agent-info.ts        # Free agent info endpoints
│   │
│   ├── data-sources/              # External data fetching
│   │   ├── ens.ts                # ENS registry queries
│   │   ├── blockchain.ts         # On-chain transaction history
│   │   ├── farcaster.ts          # Farcaster API integration
│   │   ├── lens.ts               # Lens Protocol API integration
│   │   └── index.ts              # Re-exports
│   │
│   ├── scoring/                   # Reputation scoring algorithms
│   │   ├── aggregator.ts         # Combines all scores with weights
│   │   ├── ens-scorer.ts         # ENS reputation (20% weight)
│   │   ├── onchain-scorer.ts     # Transaction patterns (30% weight)
│   │   ├── wallet-age-scorer.ts  # Account tenure (15% weight)
│   │   ├── social-scorer.ts      # Social graphs (35% weight)
│   │   └── index.ts              # Re-exports
│   │
│   ├── types/                     # TypeScript type definitions
│   │   ├── reputation.ts         # Core reputation types
│   │   └── index.ts              # Re-exports
│   │
│   ├── x402/                      # x402 payment integration
│   │   ├── MerchantExecutor.ts   # Payment verification & settlement
│   │   └── payment-handler.ts    # Legacy handler (deprecated)
│   │
│   └── index.ts                   # Main server entry point
│
├── .env.example                   # Environment variables template
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── README.md                      # This file
└── X402_INTEGRATION_GUIDE.md     # Detailed x402 integration docs
```

### Key Components Explained

#### 1. `src/index.ts` - Main Server

**Purpose:** Orchestrates the entire oracle service.

**Key Responsibilities:**
- Loads and validates environment variables
- Initializes data sources (ENS, Blockchain, Farcaster, Lens)
- Creates scorer instances with data sources
- Initializes `ReputationAggregator` with all scorers
- Sets up x402 `MerchantExecutor` for each paid endpoint
- Registers oracle with Agent0 (if `AGENT0_PRIVATE_KEY` is set)
- Configures Express.js routes
- Starts HTTP server

**Important Code Sections:**
```typescript
// Initialize data sources
const ensDataSource = new ENSDataSource(RPC_URL);
const blockchainDataSource = new BlockchainDataSource(RPC_URL);
const farcasterDataSource = new FarcasterDataSource(...);
const lensDataSource = new LensDataSource(...);

// Initialize scorers (each connected to a data source)
const ensScorer = new ENSScorer(ensDataSource);
const onChainScorer = new OnChainScorer(blockchainDataSource);
// ...

// Initialize aggregator (combines all scorers)
const aggregator = new ReputationAggregator(
  ensScorer, onChainScorer, walletAgeScorer, socialScorer
);

// Initialize payment handlers (one per paid endpoint)
const queryMerchantExecutor = new MerchantExecutor({
  payToAddress: PAYMENT_WALLET_ADDRESS,
  network: PAYMENT_NETWORK,
  price: QUERY_PRICE,
  // ...
});
```

#### 2. `src/api/query.ts` - Query Endpoint Handler

**Purpose:** Handles reputation query requests with x402 payment verification.

**Flow:**
1. Receives HTTP POST request with address/agentId
2. Checks for x402 payment payload in request
3. If no payment: Returns 402 with payment requirements
4. If payment present: Verifies EIP-712 signature
5. Resolves Agent0 ID to wallet address (if needed)
6. Calculates reputation score via aggregator
7. Settles payment on-chain
8. Returns score with breakdown

**Key Methods:**
- `handleQuery(req, res)`: Main request handler
- `healthCheck(req, res)`: Health endpoint

#### 3. `src/scoring/aggregator.ts` - Score Aggregator

**Purpose:** Combines all component scores into final 0-100 reputation score.

**How it works:**
1. Calculates all component scores in parallel (for performance)
2. Applies weights to each component
3. Sums weighted scores
4. Rounds to nearest integer

**Key Methods:**
- `calculateReputationScore(address, queryId, queriedBy)`: Main scoring method
- `getBreakdown(address)`: Get component breakdown without final score

**Weight Configuration:**
```typescript
const DEFAULT_WEIGHTS = {
  ens: 0.20,        // 20% of total
  onchain: 0.30,    // 30% of total
  walletAge: 0.15,  // 15% of total
  social: 0.35      // 35% of total
};
```

#### 4. `src/scoring/*-scorer.ts` - Component Scorers

Each scorer:
- Takes a wallet address as input
- Fetches relevant data from its data source
- Applies scoring algorithm
- Returns score (0-100) with breakdown

**Common Pattern:**
```typescript
class ComponentScorer {
  constructor(private dataSource: DataSource) {}
  
  async calculateScore(address: string): Promise<number> {
    const factors = await this.dataSource.getFactors(address);
    // Apply scoring algorithm
    return score; // 0-100
  }
  
  async getScoreBreakdown(address: string): Promise<ScoreBreakdown> {
    const factors = await this.dataSource.getFactors(address);
    const score = await this.calculateScore(address);
    return { score, weight: 0.XX, factors };
  }
}
```

#### 5. `src/data-sources/*.ts` - Data Sources

**Purpose:** Fetch raw data from external sources (blockchain, APIs).

**Responsibilities:**
- Query blockchain RPC for transaction history
- Query ENS registry for name resolution
- Query Farcaster/Lens APIs for social data
- Normalize data into standardized factor objects

**Common Interface:**
```typescript
class DataSource {
  async getFactors(address: string): Promise<Factors> {
    // Fetch data from external source
    // Normalize and return
  }
}
```

#### 6. `src/x402/MerchantExecutor.ts` - Payment Handler

**Purpose:** Handles x402 payment verification and settlement.

**Key Features:**
- Supports two settlement modes:
  - **Facilitator**: Uses x402.org facilitator (no gas costs)
  - **Direct**: Oracle settles directly on-chain (requires gas)
- Verifies EIP-3009 `transferWithAuthorization` signatures
- Creates payment requirement responses (402 status)
- Settles payments after service delivery

**Important Methods:**
- `verifyPayment(payload)`: Verify payment signature
- `settlePayment(payload)`: Execute on-chain settlement
- `createPaymentRequiredResponse()`: Generate 402 response

#### 7. `src/agent0/` - Agent0 Integration

**Purpose:** Integrate with Agent0 ecosystem for agent discovery and feedback.

**Components:**
- `registration.ts`: Register oracle as Agent0 agent (ERC-8004)
- `data-fetcher.ts`: Query Agent0 registry for other agents' info
- `feedback-client.ts`: Submit/retrieve feedback about agents

---

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

**Required Variables:**
```env
RPC_URL=https://sepolia.base.org
PAYMENT_WALLET_ADDRESS=0xYourWalletAddress
PAYMENT_NETWORK=base-sepolia
```

**Optional Variables:**
- `PORT=3000` - Server port (default: 3000)
- `QUERY_PRICE=0.01` - Price per query in USD (default: 0.01)
- `AGENT0_PRIVATE_KEY=0x...` - For Agent0 registration (optional)
- `FARCASTER_API_KEY=...` - For social scoring (optional)
- `LENS_API_URL=...` - For social scoring (optional)

### Run

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

---

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
    "maxAmountRequired": "10000",
    "resource": "http://localhost:3000/query",
    "description": "Reputation scoring oracle query",
    "mimeType": "application/json",
    "maxTimeoutSeconds": 600
  }],
  "error": "Payment required for service"
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
      "cached": false
    }
  },
  "settlement": {
    "success": true,
    "transaction": "0xabc123...",
    "network": "base-sepolia",
    "payer": "0xAgentA..."
  },
  "message": "Reputation score calculated for 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

### Other Endpoints

- `POST /activity` - Register agent activity (paid)
- `POST /feedback` - Submit feedback about an agent (paid)
- `GET /agent/:agentId/info` - Get agent information (free)
- `GET /health` - Health check (free)

---

## 🔗 Integration with x402

The oracle uses the [x402 payment protocol](https://github.com/google-agentic-commerce/a2a-x402) for micropayments.

### Payment Flow

1. **Payment Request**: Oracle returns payment requirements (402 status)
2. **Payment Signature**: Agent signs EIP-3009 `transferWithAuthorization`
3. **Payment Verification**: Oracle verifies signature cryptographically
4. **Service Execution**: Oracle calculates reputation score
5. **Payment Settlement**: Oracle settles payment on-chain (via facilitator or direct)

### Settlement Modes

- **Facilitator Mode** (default): Uses x402.org facilitator, no gas costs for oracle
- **Direct Mode**: Oracle settles directly on-chain, oracle pays gas fees

### Example Client Integration

See [X402_INTEGRATION_GUIDE.md](./X402_INTEGRATION_GUIDE.md) for detailed examples.

---

## 🛠️ Development

### Project Structure

- **Data Sources** (`src/data-sources/`): Fetch raw data from external APIs/blockchain
- **Scorers** (`src/scoring/`): Calculate component scores (0-100) using scoring algorithms
- **Aggregator** (`src/scoring/aggregator.ts`): Combines scores with weights
- **API** (`src/api/`): Express.js endpoints with x402 payment handling
- **Payment Handler** (`src/x402/MerchantExecutor.ts`): x402 payment integration
- **Agent0 Integration** (`src/agent0/`): Agent0 SDK integration for registry and feedback

### TODO: Implementation Status

Current implementation includes:
- ✅ Core scoring framework
- ✅ x402 payment integration
- ✅ Agent0 SDK integration
- ✅ API endpoints structure
- ✅ TypeScript type definitions

Pending implementation (marked with `TODO` comments):
- ⏳ ENS data fetching from ENS registry
- ⏳ Blockchain transaction history parsing (full implementation)
- ⏳ Farcaster/Lens API integration (basic structure ready)
- ⏳ Caching layer for performance
- ⏳ Rate limiting and security enhancements

### Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes
4. Add tests (if applicable)
5. Submit a pull request

---

## 📝 Environment Variables

See [.env.example](./.env.example) for a complete list of all environment variables.

**Required:**
- `RPC_URL` - Blockchain RPC endpoint
- `PAYMENT_WALLET_ADDRESS` - Wallet to receive USDC payments
- `PAYMENT_NETWORK` - Network for payments (base-sepolia, base, etc.)

**Optional:**
- `PORT` - Server port (default: 3000)
- `QUERY_PRICE` - Price per query in USD (default: 0.01)
- `AGENT0_PRIVATE_KEY` - For Agent0 registration
- `SETTLEMENT_MODE` - Payment settlement mode (facilitator/direct)
- `FARCASTER_API_KEY` - For social scoring
- `LENS_API_URL` - For social scoring

---

## 🔐 Security

- ✅ Payment verification via x402 facilitator (EIP-712 signatures)
- ✅ Address format validation
- ✅ Error handling and logging
- ✅ Environment variable validation
- ⏳ Rate limiting (TODO)
- ⏳ Input sanitization (TODO)
- ⏳ API authentication (TODO)

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- [x402 Protocol](https://github.com/google-agentic-commerce/a2a-x402) - Micropayment protocol for agent-to-agent transactions
- [Agent0 SDK](https://sdk.ag0.xyz/) - Agent registry and discovery platform
- [Ethereum Name Service (ENS)](https://ens.domains/) - Decentralized naming system
- [Farcaster](https://farcaster.xyz/) - Decentralized social network
- [Lens Protocol](https://lens.xyz/) - Decentralized social graph

Built for the agentic commerce ecosystem.
