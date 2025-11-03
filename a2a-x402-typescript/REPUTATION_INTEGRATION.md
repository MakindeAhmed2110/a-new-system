# Reputation Oracle Integration

The client agent now automatically checks merchant reputation **before** completing transactions with merchants using the x402 payment protocol.

## Available Reputation Oracle Endpoints

### Paid Endpoints ($0.01 USDC)

1. **POST `/query`** - Get reputation score
   - Input: `{ "address": "0x..." }` or `{ "agentId": "84532:123" }`
   - Returns: Reputation score (0-100) with detailed breakdown

2. **POST `/feedback`** - Submit feedback about an agent
   - Input: `{ "agentId": "84532:123", "score": 85, "tags": [...] }`
   - Returns: Feedback ID

### Free Endpoints

1. **GET `/agent/:agentId/info`** - Get agent information
2. **GET `/agent/:agentId/feedback`** - Get feedback summary
3. **GET `/agent/:agentId/feedback/search`** - Search feedback
4. **GET `/health`** - Health check

## How It Works

### Automatic Reputation Checking

When a client wants to buy something from a merchant:

1. **Client sends purchase request** → `sendMessageToMerchant("I want to buy a banana")`
2. **Automatic reputation check** → If merchant address is known, reputation is checked first
3. **Merchant responds** → Payment requirements are received
4. **Merchant reputation verified** → Reputation score is checked using the merchant's wallet address from payment requirements
5. **User decision** → Reputation score and warnings are shown to user before payment

### Manual Reputation Checking

Users can manually check merchant reputation using the `checkMerchantReputation` tool:

```typescript
// Tool automatically available in client agent
checkMerchantReputation({
  address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
})
```

## Configuration

Add to your `.env` file in `client-agent/`:

```bash
# Reputation Oracle URL (local or Railway deployment)
REPUTATION_ORACLE_URL=http://localhost:3000
# Or for production:
# REPUTATION_ORACLE_URL=https://reputation-oracle-production.up.railway.app

# Optional: Pre-configured merchant address for early reputation checks
MERCHANT_WALLET_ADDRESS=0xYourMerchantAddress

# Existing variables
MERCHANT_AGENT_URL=http://localhost:10000
WALLET_PRIVATE_KEY=your_private_key
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
```

## Reputation Score Breakdown

The reputation oracle returns a score from 0-100 based on:

- **ENS Identity** (20% weight): Reverse resolution, primary name, account age
- **On-Chain Activity** (30% weight): Transaction count, counterparties, volume
- **Wallet Age** (15% weight): Account tenure (new/established/veteran)
- **Social Profiles** (35% weight): Farcaster and Lens Protocol activity

### Trust Levels

- **70-100**: Highly Trusted ✅ - Safe to proceed
- **50-69**: Moderately Trusted ⚠️ - Proceed with normal caution
- **0-49**: Low Trust ❌ - Consider verifying identity or using smaller amounts

## Example Flow

### 1. User wants to buy something

```
User: "I want to buy a banana"
```

### 2. Client checks reputation (if merchant address known)

```
🔍 Checking merchant reputation...
✅ Merchant reputation: 85/100 - Highly Trusted
```

### 3. Client contacts merchant

```
📤 Contacting merchant...
Merchant: "I can sell you a banana for 1 USDC"
```

### 4. Reputation check on payment requirements

```
🛡️ Checking reputation for merchant: 0x742d35Cc...
✅ Reputation Verified: Merchant has a high trust score (85/100).

The merchant agent responded! They're selling banana for 1.000000 USDC.

Payment Details:
- Product: banana
- Price: 1.000000 USDC
- Network: base-sepolia
- Payment Token: USDC
- Merchant Address: 0x742d35Cc...
✅ Reputation Verified: Merchant has a high trust score (85/100).

Would you like to proceed with this payment?
```

### 5. User confirms and payment proceeds

```
User: "yes"
✅ Payment completed successfully!
```

## Security Warnings

If merchant has low reputation (< 50), the system will show:

```
⚠️ **SECURITY WARNING**: This merchant has a LOW reputation score (35/100). 
Consider verifying their identity before proceeding.
```

## Error Handling

- If reputation oracle is unavailable, transaction proceeds without reputation check (with warning)
- If reputation check fails, transaction can still proceed (user decision)
- All errors are logged and shown to user clearly

## Testing

1. **Start reputation oracle:**
   ```bash
   cd reputation-oracle
   npm start
   ```

2. **Start merchant agent:**
   ```bash
   cd merchant-agent
   npm start
   ```

3. **Start client agent:**
   ```bash
   cd client-agent
   npm start
   ```

4. **Test purchase:**
   - Ask client: "I want to buy a banana"
   - Watch for reputation check logs
   - Confirm payment

## Production Deployment

1. Deploy reputation oracle to Railway (see `reputation-oracle/RAILWAY.md`)
2. Update `REPUTATION_ORACLE_URL` in client agent `.env`
3. Set `MERCHANT_WALLET_ADDRESS` if you have a known merchant

The integration will work automatically!

