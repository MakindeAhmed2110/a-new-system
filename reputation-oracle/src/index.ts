/**
 * Reputation Scoring Oracle - Main Server
 * x402-enabled oracle for agent counterparty risk assessment
 */

import express from 'express';
import dotenv from 'dotenv';
import { ReputationAggregator } from './scoring/aggregator';
import { ENSScorer } from './scoring/ens-scorer';
import { OnChainScorer } from './scoring/onchain-scorer';
import { WalletAgeScorer } from './scoring/wallet-age-scorer';
import { SocialScorer } from './scoring/social-scorer';
import { ENSDataSource } from './data-sources/ens';
import { BlockchainDataSource } from './data-sources/blockchain';
import { FarcasterDataSource } from './data-sources/farcaster';
import { LensDataSource } from './data-sources/lens';
import { MerchantExecutor, type MerchantExecutorOptions } from './x402/MerchantExecutor';
import type { Network } from 'x402/types';
import { ReputationQueryHandler } from './api/query';
import { Agent0Registration } from './agent0/registration';
import { Agent0DataFetcher } from './agent0/data-fetcher';
import { ActivityHandler } from './api/activity';
import { FeedbackHandler } from './api/feedback';
import { AgentInfoHandler } from './api/agent-info';
import { Agent0FeedbackClient } from './agent0/feedback-client';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['RPC_URL', 'PAYMENT_WALLET_ADDRESS', 'PAYMENT_NETWORK'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ ERROR: ${envVar} is not set in .env file`);
    process.exit(1);
  }
}

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const RPC_URL = process.env.RPC_URL!;
const PAYMENT_WALLET_ADDRESS = process.env.PAYMENT_WALLET_ADDRESS!;
const PAYMENT_NETWORK = (process.env.PAYMENT_NETWORK || 'base-sepolia') as Network;
const QUERY_PRICE = parseFloat(process.env.QUERY_PRICE || '0.01'); // $0.01 per query
const ACTIVITY_PRICE = parseFloat(process.env.ACTIVITY_PRICE || '0.01'); // $0.01 per activity registration
const FEEDBACK_PRICE = parseFloat(process.env.FEEDBACK_PRICE || '0.01'); // $0.01 per feedback
const SERVICE_URL = process.env.SERVICE_URL || `http://localhost:${PORT}`;

// Chain ID mapping for Agent0
const CHAIN_IDS: Record<string, number> = {
  base: 8453,
  'base-sepolia': 84532,
  ethereum: 1,
  sepolia: 11155111,
  polygon: 137,
  'polygon-amoy': 80002,
};
const AGENT0_CHAIN_ID = CHAIN_IDS[PAYMENT_NETWORK] || 84532; // Default to Base Sepolia

// USDC contract addresses by network
const USDC_CONTRACTS: Record<string, string> = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Ethereum Sepolia USDC test token
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  'polygon-amoy': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
};

// Initialize data sources
const ensDataSource = new ENSDataSource(RPC_URL);
const blockchainDataSource = new BlockchainDataSource(RPC_URL);
const farcasterDataSource = new FarcasterDataSource(
  process.env.FARCASTER_API_URL,
  process.env.FARCASTER_API_KEY
);
const lensDataSource = new LensDataSource(process.env.LENS_API_URL);

// Initialize scorers
const ensScorer = new ENSScorer(ensDataSource);
const onChainScorer = new OnChainScorer(blockchainDataSource);
const walletAgeScorer = new WalletAgeScorer(blockchainDataSource);
const socialScorer = new SocialScorer(farcasterDataSource, lensDataSource);

// Initialize aggregator
const aggregator = new ReputationAggregator(
  ensScorer,
  onChainScorer,
  walletAgeScorer,
  socialScorer
);

// Initialize MerchantExecutor for query endpoint
const queryMerchantOptions: MerchantExecutorOptions = {
  payToAddress: PAYMENT_WALLET_ADDRESS,
  network: PAYMENT_NETWORK,
  price: QUERY_PRICE,
  facilitatorUrl: process.env.FACILITATOR_URL,
  facilitatorApiKey: process.env.FACILITATOR_API_KEY,
  resourceUrl: `${SERVICE_URL}/query`,
  settlementMode: process.env.SETTLEMENT_MODE === 'local' ? 'direct' : 'facilitator',
  rpcUrl: RPC_URL,
  privateKey: process.env.PRIVATE_KEY,
  assetAddress: USDC_CONTRACTS[PAYMENT_NETWORK],
  assetName: 'USDC',
  chainId: CHAIN_IDS[PAYMENT_NETWORK] || 84532,
};

const queryMerchantExecutor = new MerchantExecutor(queryMerchantOptions);

// Initialize MerchantExecutor for activity endpoint
const activityMerchantOptions: MerchantExecutorOptions = {
  payToAddress: PAYMENT_WALLET_ADDRESS,
  network: PAYMENT_NETWORK,
  price: ACTIVITY_PRICE,
  facilitatorUrl: process.env.FACILITATOR_URL,
  facilitatorApiKey: process.env.FACILITATOR_API_KEY,
  resourceUrl: `${SERVICE_URL}/activity`,
  settlementMode: process.env.SETTLEMENT_MODE === 'local' ? 'direct' : 'facilitator',
  rpcUrl: RPC_URL,
  privateKey: process.env.PRIVATE_KEY,
  assetAddress: USDC_CONTRACTS[PAYMENT_NETWORK],
  assetName: 'USDC',
  chainId: CHAIN_IDS[PAYMENT_NETWORK] || 84532,
};

const activityMerchantExecutor = new MerchantExecutor(activityMerchantOptions);

// Initialize MerchantExecutor for feedback endpoint
const feedbackMerchantOptions: MerchantExecutorOptions = {
  payToAddress: PAYMENT_WALLET_ADDRESS,
  network: PAYMENT_NETWORK,
  price: FEEDBACK_PRICE,
  facilitatorUrl: process.env.FACILITATOR_URL,
  facilitatorApiKey: process.env.FACILITATOR_API_KEY,
  resourceUrl: `${SERVICE_URL}/feedback`,
  settlementMode: process.env.SETTLEMENT_MODE === 'local' ? 'direct' : 'facilitator',
  rpcUrl: RPC_URL,
  privateKey: process.env.PRIVATE_KEY,
  assetAddress: USDC_CONTRACTS[PAYMENT_NETWORK],
  assetName: 'USDC',
  chainId: CHAIN_IDS[PAYMENT_NETWORK] || 84532,
};

const feedbackMerchantExecutor = new MerchantExecutor(feedbackMerchantOptions);

// Determine settlement mode for logging
const settlementMode = queryMerchantOptions.settlementMode || 
  (process.env.PRIVATE_KEY ? 'direct' : 'facilitator');

console.log(`
🔮 Reputation Scoring Oracle
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Configuration:
  Port: ${PORT}
  RPC URL: ${RPC_URL}
  Payment Network: ${PAYMENT_NETWORK}
  Payment Address: ${PAYMENT_WALLET_ADDRESS}
  Settlement Mode: ${settlementMode}
  Prices:
    - Query: $${QUERY_PRICE.toFixed(2)} USDC
    - Activity: $${ACTIVITY_PRICE.toFixed(2)} USDC
    - Feedback: $${FEEDBACK_PRICE.toFixed(2)} USDC
  USDC Contract: ${USDC_CONTRACTS[PAYMENT_NETWORK] || 'Not configured'}
  Service URL: ${SERVICE_URL}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// Initialize Agent0 data fetcher (read-only, for querying other agents)
const agent0DataFetcher = new Agent0DataFetcher(RPC_URL, AGENT0_CHAIN_ID);

// Initialize Agent0 registration (optional - if private key is provided)
let agent0Registration: Agent0Registration | null = null;
let oracleAgentId: string | null = null;

if (process.env.AGENT0_PRIVATE_KEY) {
  const agentUrl = process.env.AGENT0_AGENT_URL || `http://localhost:${PORT}`;
  
  agent0Registration = new Agent0Registration({
    privateKey: process.env.AGENT0_PRIVATE_KEY,
    rpcUrl: process.env.AGENT0_RPC_URL || RPC_URL,
    chainId: AGENT0_CHAIN_ID,
    agentName: 'Reputation Scoring Oracle',
    agentDescription: 'A verifiable x402-enabled oracle that aggregates ENS history, on-chain transaction patterns, wallet age, and social graph data (Farcaster/Lens) into a single trust score (0-100) for agent counterparty risk assessment.',
    agentUrl: agentUrl,
    ipfs: process.env.IPFS_API_URL ? {
      apiUrl: process.env.IPFS_API_URL,
      apiKey: process.env.IPFS_API_KEY,
      provider: (process.env.IPFS_PROVIDER as any) || 'node',
      pinataJwt: process.env.PINATA_JWT,
      filecoinPrivateKey: process.env.FILECOIN_PRIVATE_KEY,
    } : undefined,
  });

  // Register on startup (async, don't block)
  agent0Registration.initialize()
    .then((agentId) => {
      oracleAgentId = agentId;
      console.log(`\n🤖 Oracle registered as Agent0 agent: ${agentId}\n`);
    })
    .catch((error) => {
      console.error('⚠️  Agent0 registration failed (oracle will continue without registration):', error.message);
    });
} else {
  console.log('ℹ️  Agent0 registration skipped (AGENT0_PRIVATE_KEY not set)');
}

// Initialize API handler
const queryHandler = new ReputationQueryHandler(
  aggregator, 
  queryMerchantExecutor, 
  agent0DataFetcher
);

// Initialize Express app
const app = express();
app.use(express.json());

// Initialize additional API handlers
const activityHandler = new ActivityHandler(agent0DataFetcher);
const feedbackClient = new Agent0FeedbackClient(
  process.env.AGENT0_RPC_URL || RPC_URL,
  AGENT0_CHAIN_ID,
  process.env.AGENT0_PRIVATE_KEY // Optional - only needed for submitting feedback
);
const feedbackHandler = new FeedbackHandler(
  feedbackClient,
  feedbackMerchantExecutor,
  agent0DataFetcher
);
const agentInfoHandler = new AgentInfoHandler(agent0DataFetcher, aggregator);

// Routes
app.get('/health', (req, res) => {
  queryHandler.healthCheck(req, res).catch(console.error);
});

// Query endpoint (paid)
app.post('/query', (req, res) => {
  queryHandler.handleQuery(req, res).catch(console.error);
});

// Activity registration endpoints (paid - $0.01)
app.post('/activity', (req, res) => {
  activityHandler.registerActivity(req, res, activityMerchantExecutor).catch(console.error);
});
app.get('/activity/:agentId', (req, res) => {
  activityHandler.getActivities(req, res).catch(console.error);
});
app.get('/activity/address/:address', (req, res) => {
  activityHandler.getActivities(req, res).catch(console.error);
});

// Feedback endpoints (paid submission - $0.01, free for reading)
app.post('/feedback', (req, res) => {
  feedbackHandler.submitFeedback(req, res).catch(console.error);
});
app.get('/agent/:agentId/feedback', (req, res) => {
  feedbackHandler.getFeedbackSummary(req, res).catch(console.error);
});
app.get('/agent/:agentId/feedback/search', (req, res) => {
  feedbackHandler.searchFeedback(req, res).catch(console.error);
});

// Agent info endpoints (free)
app.get('/agent/:agentId/info', (req, res) => {
  agentInfoHandler.getAgentInfo(req, res).catch(console.error);
});
app.get('/agents/search', (req, res) => {
  agentInfoHandler.searchAgents(req, res).catch(console.error);
});

// Error handler - x402 payment responses are handled in endpoint handlers
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    });
});

// Start server
app.listen(PORT, () => {
  console.log(`
✅ Server running on http://localhost:${PORT}

📡 API Endpoints:
  Query (paid - $${QUERY_PRICE.toFixed(2)}):
    POST /query                    - Get reputation score for address/agent
  
  Activity (paid - $${ACTIVITY_PRICE.toFixed(2)}):
    POST /activity                 - Register agent activity
    GET  /activity/:agentId        - Get activities for agent (free)
    GET  /activity/address/:addr   - Get activities by address (free)
  
  Feedback (paid submission - $${FEEDBACK_PRICE.toFixed(2)}, free read):
    POST /feedback                 - Submit feedback about agent
    GET  /agent/:agentId/feedback  - Get feedback summary (free)
    GET  /agent/:agentId/feedback/search - Search feedback (free)
  
  Agent Info (free):
    GET  /agent/:agentId/info      - Get comprehensive agent info
    GET  /agents/search           - Search for agents
  
  Health:
    GET  /health                   - Health check

Ready to process reputation queries!
`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

