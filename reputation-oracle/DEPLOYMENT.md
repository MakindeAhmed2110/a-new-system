# Reputation Oracle - Deployment Guide

Complete guide to start and deploy the reputation oracle as a production API.

## 🚀 Quick Start (Local Development)

### Step 1: Install Dependencies

```bash
cd reputation-oracle
npm install
```

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# At minimum, set these required variables:
# - RPC_URL
# - PAYMENT_WALLET_ADDRESS
# - PAYMENT_NETWORK
```

### Step 3: Start the Server

```bash
# Development mode (with hot reload)
npm run dev

# Or production mode
npm run build
npm start
```

The API will be available at `http://localhost:3000`

### Step 4: Test the API

```bash
# Health check
curl http://localhost:3000/health

# Query reputation (will require payment)
curl -X POST http://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

---

## 🐳 Docker Deployment

### Using Dockerfile

**Build the image:**
```bash
docker build -t reputation-oracle .
```

**Run the container:**
```bash
docker run -d \
  --name reputation-oracle \
  -p 3000:3000 \
  --env-file .env \
  reputation-oracle
```

**View logs:**
```bash
docker logs -f reputation-oracle
```

### Using Docker Compose (Recommended)

**1. Create `docker-compose.yml`** (see below)

**2. Start the service:**
```bash
docker-compose up -d
```

**3. View logs:**
```bash
docker-compose logs -f
```

**4. Stop the service:**
```bash
docker-compose down
```

---

## ☁️ Production Deployment

### Option 1: Traditional Server (VPS/Cloud)

**1. Build the application:**
```bash
npm run build
```

**2. Use a process manager (PM2):**
```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start dist/index.js --name reputation-oracle

# Save PM2 configuration
pm2 save

# Set PM2 to start on system boot
pm2 startup
```

**3. Set up reverse proxy (Nginx):**
```nginx
server {
    listen 80;
    server_name oracle.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**4. Enable HTTPS (Let's Encrypt):**
```bash
sudo certbot --nginx -d oracle.yourdomain.com
```

### Option 2: Container Platforms

#### Railway

1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

#### Render

1. Create a new Web Service
2. Connect your repository
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables

#### Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Initialize
fly launch

# Deploy
fly deploy
```

#### DigitalOcean App Platform

1. Create new App from GitHub
2. Configure build settings:
   - Build Command: `npm install && npm run build`
   - Run Command: `npm start`
3. Add environment variables
4. Deploy

### Option 3: Kubernetes

See `k8s/` directory for Kubernetes manifests (create if needed).

---

## 📋 Required Environment Variables

### Minimum Required (Server won't start without these)

```env
RPC_URL=https://sepolia.base.org
PAYMENT_WALLET_ADDRESS=0xYourWalletAddress
PAYMENT_NETWORK=base-sepolia
```

### Recommended for Production

```env
# Server
PORT=3000
SERVICE_URL=https://oracle.yourdomain.com
NODE_ENV=production

# Pricing
QUERY_PRICE=0.01
ACTIVITY_PRICE=0.01
FEEDBACK_PRICE=0.01

# Payment Settlement
SETTLEMENT_MODE=facilitator
FACILITATOR_URL=https://x402.org/facilitator

# Agent0 (Optional but recommended)
AGENT0_PRIVATE_KEY=0xYourPrivateKey
AGENT0_AGENT_URL=https://oracle.yourdomain.com
```

---

## 🔍 Health Checks & Monitoring

### Health Endpoint

The oracle exposes a health check endpoint:

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "reputation-scoring-oracle",
  "version": "0.1.0",
  "timestamp": 1234567890
}
```

### Monitoring Recommendations

1. **Uptime Monitoring**: Use services like:
   - UptimeRobot
   - Pingdom
   - StatusCake

2. **Application Monitoring**: 
   - PM2 Plus (if using PM2)
   - New Relic
   - Datadog

3. **Error Tracking**:
   - Sentry
   - Rollbar

---

## 🛡️ Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Implement rate limiting (TODO in code)
4. **CORS**: Configure CORS appropriately for your use case
5. **Private Keys**: Store private keys securely (use secrets management)
6. **Network Security**: Use firewall rules to restrict access
7. **Regular Updates**: Keep dependencies updated

---

## 📊 API Endpoints

Once running, the API exposes these endpoints:

- `POST /query` - Get reputation score (paid, $0.01)
- `POST /activity` - Register activity (paid, $0.01)
- `POST /feedback` - Submit feedback (paid, $0.01)
- `GET /health` - Health check (free)
- `GET /agent/:agentId/info` - Agent info (free)
- `GET /agents/search` - Search agents (free)

See the [main README](README.md) for detailed API documentation.

---

## 🔄 Updating the Oracle

### Manual Update

```bash
# Pull latest code
git pull

# Rebuild
npm run build

# Restart (if using PM2)
pm2 restart reputation-oracle
```

### Docker Update

```bash
# Rebuild image
docker-compose build

# Restart services
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Server won't start

- Check that all required environment variables are set
- Verify RPC URL is accessible
- Check wallet address format (must be valid Ethereum address)

### Payment not working

- Verify `PAYMENT_WALLET_ADDRESS` has correct format
- Check `PAYMENT_NETWORK` matches your RPC URL
- Ensure facilitator is accessible (if using facilitator mode)

### Port already in use

- Change `PORT` in `.env` file
- Or kill process using port: `lsof -ti:3000 | xargs kill`

### Docker issues

- Check Docker logs: `docker logs reputation-oracle`
- Verify `.env` file is mounted correctly
- Ensure ports are not already in use

---

## 📞 Support

For issues or questions:
- Check the [main README](README.md)
- Review [X402_INTEGRATION_GUIDE.md](X402_INTEGRATION_GUIDE.md)
- Open an issue on GitHub

