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
import { PaymentHandler } from './x402/payment-handler';
import { ReputationQueryHandler } from './api/query';

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
const PAYMENT_NETWORK = process.env.PAYMENT_NETWORK || 'base-sepolia';
const QUERY_PRICE = parseFloat(process.env.QUERY_PRICE || '0.50');

// USDC contract addresses by network
const USDC_CONTRACTS: Record<string, string> = {
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  'polygon-amoy': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
};

console.log(`
🔮 Reputation Scoring Oracle
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Configuration:
  Port: ${PORT}
  RPC URL: ${RPC_URL}
  Payment Network: ${PAYMENT_NETWORK}
  Payment Address: ${PAYMENT_WALLET_ADDRESS}
  Query Price: $${QUERY_PRICE.toFixed(2)} USDC
  USDC Contract: ${USDC_CONTRACTS[PAYMENT_NETWORK] || 'Not configured'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

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

// Initialize payment handler
const paymentHandler = new PaymentHandler({
  price: QUERY_PRICE,
  payToAddress: PAYMENT_WALLET_ADDRESS,
  network: PAYMENT_NETWORK,
  usdcContract: USDC_CONTRACTS[PAYMENT_NETWORK],
});

// Initialize API handler
const queryHandler = new ReputationQueryHandler(aggregator, paymentHandler);

// Initialize Express app
const app = express();
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
  queryHandler.healthCheck(req, res).catch(console.error);
});

app.post('/query', (req, res) => {
  queryHandler.handleQuery(req, res).catch(console.error);
});

// Error handler for x402 payment exceptions
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && err.name === 'x402PaymentRequiredException') {
    const { accepts, error } = err.getAcceptsArray
      ? { accepts: err.getAcceptsArray(), error: err.message }
      : { accepts: [], error: err.message };

    res.status(402).json({
      x402Version: 1,
      accepts,
      error,
    });
    return;
  }

  next(err);
});

// Start server
app.listen(PORT, () => {
  console.log(`
✅ Server running on http://localhost:${PORT}
📡 Query endpoint: POST /query
💚 Health check: GET /health

Ready to process reputation queries!
`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

