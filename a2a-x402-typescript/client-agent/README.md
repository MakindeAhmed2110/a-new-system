# x402 Client Agent

An orchestrator agent that can interact with merchant agents and handle x402 payment flows using cryptocurrency.

## Features

- 🤖 Connects to merchant agents
- 💰 Payment handling with user confirmation
- 🔐 Secure wallet integration
- ⛓️ USDC payments on Base Sepolia
- ✅ Transparent payment flow

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
cp .env.example .env
```

Edit with your values:

```bash
# OpenRouter Configuration (REQUIRED)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxx
# Optional: Customize model (default: openrouter/google/gemini-2.0-flash)
# OPENROUTER_MODEL=openrouter/google/gemini-2.0-flash
# OPENROUTER_MODEL=openrouter/anthropic/claude-3.5-sonnet
# OPENROUTER_MODEL=openai/gpt-4o
# Optional: For OpenRouter rankings
# OPENROUTER_SITE_URL=http://localhost:3001
# OPENROUTER_SITE_NAME=x402-client-agent

# Wallet Configuration (REQUIRED)
WALLET_PRIVATE_KEY=0xYourClientPrivateKey
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# Agent URLs
MERCHANT_AGENT_URL=http://localhost:10000

# Reputation Oracle Integration (optional but recommended)
REPUTATION_ORACLE_URL=http://localhost:3000
# For production: REPUTATION_ORACLE_URL=https://your-oracle.up.railway.app

# Optional: Pre-configured merchant address for reputation checks
MERCHANT_WALLET_ADDRESS=0xYourMerchantAddress
```

**Note:** The agent now uses OpenRouter instead of direct Gemini API. You can access multiple models through OpenRouter including Gemini, Claude, GPT-4, and more. See [OpenRouter Models](https://openrouter.ai/models) for available models.

### 3. Fund Your Wallet

Get testnet tokens:
- **ETH** (gas): https://www.alchemy.com/faucets/base-sepolia
- **USDC** (payments): https://faucet.circle.com/

### 4. Start the Agent

```bash
npm run dev
```

## Example Interaction

```
You: I want to buy a banana

Agent: The merchant is requesting payment of 1.00 USDC for a banana.
       Do you want to proceed with the payment?

You: yes

Agent: ✅ Payment completed successfully!
       Transaction: 0x1234...

       View on BaseScan: https://sepolia.basescan.org/tx/0x1234...
```

## How It Works

1. **Request product** → Agent contacts merchant
2. **Reputation check** → Automatically checks merchant reputation score (if available)
3. **Receive payment requirements** → Merchant responds with USDC amount
4. **Merchant reputation verified** → Reputation score shown with payment details
5. **User confirmation** → Agent shows payment details + reputation and asks to proceed
6. **Approve tokens** → Wallet approves USDC spending (client pays gas)
7. **Transfer payment** → Wallet transfers USDC to merchant (client pays gas)
8. **Order confirmed** → User receives confirmation

## Security

⚠️ **Private Key**: Your `WALLET_PRIVATE_KEY` can spend tokens!

- Never commit `.env` to git
- Use separate wallets for testnet vs mainnet
- Consider hardware wallet for production

**Approval Buffer**: The wallet approves 10% extra to minimize transactions:
```typescript
// If merchant requests 100 USDC, approve 110 USDC
const approvalAmount = (amount * 110n) / 100n;
```

**Revoke approval**:
```typescript
await usdcContract.approve(merchantAddress, 0);
```

## Network Configuration

**Base Sepolia (Testnet)**
- RPC: `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY`
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- Chain ID: 84532

**Base (Mainnet)**
- RPC: `https://base-mainnet.g.alchemy.com/v2/YOUR_KEY`
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Chain ID: 8453

## Troubleshooting

**Insufficient balance**
- Fund wallet with USDC: https://faucet.circle.com/
- Check balance: Your wallet address is shown when agent starts

**Insufficient allowance**
- Wallet auto-approves. If it fails, check you have ETH for gas

**Transaction failed**
- Ensure wallet has ETH for gas fees
- Verify RPC URL is correct
- Check network connectivity

## Reputation Checking

The client agent now automatically checks merchant reputation before transactions using the Reputation Scoring Oracle. See [REPUTATION_INTEGRATION.md](../REPUTATION_INTEGRATION.md) for details.

**Features:**
- Automatic reputation checks before purchase requests
- Reputation verification when payment details are received
- Security warnings for low-reputation merchants
- Manual reputation checking via `checkMerchantReputation` tool

## Related

- [Merchant Agent](../merchant-agent/README.md)
- [Reputation Oracle Integration](../REPUTATION_INTEGRATION.md)
- [x402 Protocol Library](../x402_a2a/README.md)

## License

Apache-2.0
