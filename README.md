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

See the [reputation-oracle README](reputation-oracle/README.md) for details.

## 🎯 Features

### x402 Payment Protocol
- **Exception-based payment flow** - Throw exceptions to request payments dynamically
- **Full TypeScript support** - Complete type definitions and interfaces
- **Ethereum wallet integration** - Built on ethers.js for signing and verification
- **Dynamic pricing** - Set prices based on request parameters
- **Multi-network support** - Works with Base, Base Sepolia, and other EVM chains
- **ERC-20 token payments** - Native support for USDC and other tokens

### Reputation Oracle
- **Comprehensive scoring** - Aggregates multiple data sources into a single trust score
- **ENS history analysis** - 20% weight
- **On-chain transaction patterns** - 30% weight
- **Wallet age assessment** - 15% weight
- **Social graph data** - 35% weight (Farcaster & Lens)
- **x402 payment integration** - $0.50 USDC per query

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
- Fetches data from multiple sources (ENS, blockchain, social networks)
- Calculates weighted reputation scores
- Integrates with x402 for paid queries
- Provides RESTful API for reputation queries

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

