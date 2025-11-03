# Deploying Reputation Oracle on Railway

This guide explains how to deploy the Reputation Scoring Oracle API on Railway.

## Prerequisites

1. Railway account: https://railway.app
2. GitHub repository (optional, but recommended)
3. Environment variables configured (see `.env.example`)

## Deployment Steps

### Option 1: Deploy from GitHub

1. **Connect Repository**
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `reputation-oracle` repository

2. **Configure Environment Variables**
   - In Railway project settings, go to "Variables"
   - Add all required variables from `.env.example`:
     ```
     RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
     PAYMENT_WALLET_ADDRESS=0x...
     PAYMENT_NETWORK=base-sepolia
     PORT=3000
     SERVICE_URL=https://your-app-name.up.railway.app
     ```

3. **Deploy**
   - Railway will automatically detect the Node.js project
   - It will run `npm install` and `npm start`
   - The `Procfile` tells Railway to run `npm start`

### Option 2: Deploy from CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd reputation-oracle
railway init

# Link to existing project or create new
railway link

# Add environment variables
railway variables set RPC_URL=your_rpc_url
railway variables set PAYMENT_WALLET_ADDRESS=your_address
# ... etc

# Deploy
railway up
```

## Environment Variables

### Required Variables

```bash
RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
PAYMENT_WALLET_ADDRESS=0xYourWalletAddress
PAYMENT_NETWORK=base
```

### Optional Variables

```bash
PORT=3000                                    # Railway sets this automatically
SERVICE_URL=https://your-app.up.railway.app  # Your Railway URL
QUERY_PRICE=0.01                             # Price per query in USD
ACTIVITY_PRICE=0.01                          # Price per activity registration
FEEDBACK_PRICE=0.01                          # Price per feedback submission

# Facilitator (for gasless payments)
FACILITATOR_URL=https://your-facilitator.com
FACILITATOR_API_KEY=your_api_key

# Agent0 Registration (optional)
AGENT0_PRIVATE_KEY=your_private_key
AGENT0_RPC_URL=your_rpc_url

# Data Sources (optional)
FARCASTER_API_URL=https://api.farcaster.xyz
FARCASTER_API_KEY=your_key
LENS_API_URL=https://api.lens.dev
```

## Getting Your Railway URL

After deployment:
1. Go to your Railway project dashboard
2. Click on your service
3. Go to "Settings" → "Domains"
4. Copy the generated domain (e.g., `https://reputation-oracle-production.up.railway.app`)

Use this URL in:
- `SERVICE_URL` environment variable
- `REPUTATION_ORACLE_URL` in your client applications

## Testing Deployment

```bash
# Health check (should return 200)
curl https://your-app.up.railway.app/health

# Query reputation (will return 402 for payment)
curl -X POST https://your-app.up.railway.app/query \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

## Using in Client Applications

Update your `.env` file in `a2a-x402-typescript/client-agent`:

```bash
REPUTATION_ORACLE_URL=https://your-app.up.railway.app
```

Then use the integration example from `reputation-api-example.ts`.

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify TypeScript compiles: `npm run build`

### Runtime Errors
- Check Railway logs: `railway logs`
- Verify environment variables are set correctly
- Ensure RPC URL is accessible

### Payment Issues
- Verify `PAYMENT_WALLET_ADDRESS` has sufficient balance for gas
- Check facilitator configuration if using gasless payments
- Ensure USDC contract address is correct for your network

## Production Checklist

- [ ] All environment variables configured
- [ ] Railway domain set up
- [ ] `SERVICE_URL` matches Railway domain
- [ ] Test health endpoint
- [ ] Test query endpoint (with payment)
- [ ] Update client applications with Railway URL
- [ ] Monitor Railway logs for errors

