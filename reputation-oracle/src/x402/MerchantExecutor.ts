/**
 * MerchantExecutor - x402 Payment Handler
 * Based on x402-starter-kit pattern
 * Handles payment verification and settlement for reputation oracle
 */

import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
} from 'x402/dist/cjs/types';
import { ethers } from 'ethers';

const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

const TRANSFER_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

export type SettlementMode = 'facilitator' | 'direct';

type BuiltInNetwork =
  | 'base'
  | 'base-sepolia'
  | 'polygon'
  | 'polygon-amoy'
  | 'avalanche-fuji'
  | 'avalanche'
  | 'iotex'
  | 'sei'
  | 'sei-testnet'
  | 'peaq'
  | 'solana-devnet'
  | 'solana';

const BUILT_IN_NETWORKS: Record<
  BuiltInNetwork,
  {
    chainId?: number;
    assetAddress: string;
    assetName: string;
    explorer?: string;
  }
> = {
  base: {
    chainId: 8453,
    assetAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    assetName: 'USD Coin',
    explorer: 'https://basescan.org',
  },
  'base-sepolia': {
    chainId: 84532,
    assetAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    assetName: 'USDC',
    explorer: 'https://sepolia.basescan.org',
  },
  polygon: {
    chainId: 137,
    assetAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    assetName: 'USD Coin',
    explorer: 'https://polygonscan.com',
  },
  'polygon-amoy': {
    chainId: 80002,
    assetAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    assetName: 'USDC',
    explorer: 'https://amoy.polygonscan.com',
  },
  'avalanche-fuji': {
    chainId: 43113,
    assetAddress: '0x5425890298aed601595a70AB815c96711a31Bc65',
    assetName: 'USD Coin',
    explorer: 'https://testnet.snowtrace.io',
  },
  avalanche: {
    chainId: 43114,
    assetAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    assetName: 'USD Coin',
    explorer: 'https://snowtrace.io',
  },
  iotex: {
    chainId: 4689,
    assetAddress: '0xcdf79194c6c285077a58da47641d4dbe51f63542',
    assetName: 'Bridged USDC',
    explorer: 'https://iotexscan.io',
  },
  sei: {
    chainId: 1329,
    assetAddress: '0xe15fc38f6d8c56af07bbcbe3baf5708a2bf42392',
    assetName: 'USDC',
    explorer: 'https://sei.explorers.guru',
  },
  'sei-testnet': {
    chainId: 1328,
    assetAddress: '0x4fcf1784b31630811181f670aea7a7bef803eaed',
    assetName: 'USDC',
    explorer: 'https://testnet.sei.explorers.guru',
  },
  peaq: {
    chainId: 3338,
    assetAddress: '0xbbA60da06c2c5424f03f7434542280FCAd453d10',
    assetName: 'USDC',
    explorer: 'https://scan.peaq.network',
  },
  'solana-devnet': {
    assetAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    assetName: 'USDC',
    explorer: 'https://explorer.solana.com/?cluster=devnet',
  },
  solana: {
    assetAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    assetName: 'USDC',
    explorer: 'https://explorer.solana.com',
  },
};

export interface MerchantExecutorOptions {
  payToAddress: string;
  network: Network;
  price: number;
  facilitatorUrl?: string;
  facilitatorApiKey?: string;
  resourceUrl?: string;
  settlementMode?: SettlementMode;
  rpcUrl?: string;
  privateKey?: string;
  assetAddress?: string;
  assetName?: string;
  explorerUrl?: string;
  chainId?: number;
}

export interface VerifyResult {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
}

export interface SettlementResult {
  success: boolean;
  transaction?: string;
  network: string;
  payer?: string;
  errorReason?: string;
}

export class MerchantExecutor {
  private readonly requirements: PaymentRequirements;
  private readonly explorerUrl?: string;
  private readonly mode: SettlementMode;
  private readonly facilitatorUrl?: string;
  private readonly facilitatorApiKey?: string;
  private settlementProvider?: ethers.JsonRpcProvider;
  private settlementWallet?: ethers.Wallet;
  private readonly network: Network;
  private readonly assetName: string;
  private readonly chainId?: number;

  constructor(options: MerchantExecutorOptions) {
    const builtinConfig = BUILT_IN_NETWORKS[
      options.network as BuiltInNetwork
    ] as (typeof BUILT_IN_NETWORKS)[BuiltInNetwork] | undefined;

    const assetAddress =
      options.assetAddress ?? builtinConfig?.assetAddress;
    const assetName = options.assetName ?? builtinConfig?.assetName;
    const chainId = options.chainId ?? builtinConfig?.chainId;
    const explorerUrl = options.explorerUrl ?? builtinConfig?.explorer;

    if (!assetAddress) {
      throw new Error(
        `Asset address must be provided for network "${options.network}". Set ASSET_ADDRESS in the environment.`
      );
    }

    if (!assetName) {
      throw new Error(
        `Asset name must be provided for network "${options.network}". Set ASSET_NAME in the environment.`
      );
    }

    this.network = options.network;
    this.assetName = assetName;
    this.chainId = chainId;
    this.explorerUrl = explorerUrl;

    // Description will be set by the caller or use default
    const defaultDescription = options.resourceUrl?.includes('/activity') 
      ? 'Agent activity registration service'
      : options.resourceUrl?.includes('/feedback')
      ? 'Agent feedback submission service'
      : 'Reputation scoring oracle query';
    
    this.requirements = {
      scheme: 'exact',
      network: options.network,
      asset: assetAddress,
      payTo: options.payToAddress,
      maxAmountRequired: this.getAtomicAmount(options.price),
      resource: options.resourceUrl || 'https://oracle.local/query',
      description: defaultDescription,
      mimeType: 'application/json',
      maxTimeoutSeconds: 600,
      extra: {
        name: assetName,
        version: '2',
      },
    };

    // Determine settlement mode
    // Priority: explicit setting > private key availability > facilitator URL
    if (options.settlementMode) {
      this.mode = options.settlementMode;
    } else if (options.privateKey) {
      // If private key is provided, prefer direct mode for better control
      this.mode = 'direct';
    } else if (options.facilitatorUrl) {
      this.mode = 'facilitator';
    } else {
      // Default: try facilitator, but will fallback to local verification
      this.mode = 'facilitator';
    }
    
    console.log(`💳 Payment settlement mode: ${this.mode}`);

    // Initialize wallet if private key is provided (for direct mode or fallback)
    if (options.privateKey) {
      if (options.network === 'solana' || options.network === 'solana-devnet') {
        throw new Error(
          'Direct settlement is only supported on EVM networks.'
        );
      }

      const normalizedKey = options.privateKey.startsWith('0x')
        ? options.privateKey
        : `0x${options.privateKey}`;

      const rpcUrl = options.rpcUrl || this.getDefaultRpcUrl(options.network);

      if (!rpcUrl) {
        throw new Error(
          `Direct settlement requires an RPC URL for network "${options.network}".`
        );
      }

      if (typeof chainId !== 'number') {
        throw new Error(
          `Direct settlement requires a numeric CHAIN_ID for network "${options.network}".`
        );
      }

      try {
        this.settlementProvider = new ethers.JsonRpcProvider(rpcUrl);
        this.settlementWallet = new ethers.Wallet(
          normalizedKey,
          this.settlementProvider
        );
          const walletAddress = this.settlementWallet.address;
          if (this.mode === 'direct') {
            console.log('⚡ Direct settlement enabled (local wallet configured)');
            console.log(`   Settlement wallet: ${walletAddress}`);
            console.log(`   ⚠️  Ensure this wallet has native tokens (ETH) for gas fees on ${this.network}!`);
          } else {
            console.log('⚡ Settlement wallet configured (for fallback if facilitator fails)');
            console.log(`   Settlement wallet: ${walletAddress}`);
            console.log(`   ⚠️  Ensure this wallet has native tokens (ETH) for gas fees on ${this.network}!`);
          }
      } catch (error) {
        throw new Error(
          `Failed to initialize settlement wallet: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // Configure facilitator if not in direct mode
    if (this.mode === 'facilitator') {
      this.facilitatorUrl = options.facilitatorUrl || DEFAULT_FACILITATOR_URL;
      this.facilitatorApiKey = options.facilitatorApiKey;
    }
  }

  getPaymentRequirements(): PaymentRequirements {
    return this.requirements;
  }

  createPaymentRequiredResponse() {
    return {
      x402Version: 1,
      accepts: [this.requirements],
      error: 'Payment required for service',
    };
  }

  async verifyPayment(payload: PaymentPayload): Promise<VerifyResult> {
    console.log('\n🔍 Verifying payment...');
    console.log(`   Network: ${payload.network}`);
    console.log(`   Scheme: ${payload.scheme}`);

    try {
      let result: VerifyResult;
      
      // Try facilitator first if configured, fallback to local verification
      if (this.mode === 'facilitator') {
        console.log('   Mode: facilitator (will fallback to local if facilitator fails)');
        try {
          result = await this.callFacilitator<VerifyResult>('verify', payload);
          console.log('   ✅ Facilitator verification succeeded');
        } catch (facilitatorError: any) {
          console.warn(`   ⚠️ Facilitator verification failed: ${facilitatorError.message}`);
          console.log('   🔄 Falling back to local verification...');
          result = this.verifyPaymentLocally(payload, this.requirements);
        }
      } else {
        console.log('   Mode: direct (using local verification)');
        result = this.verifyPaymentLocally(payload, this.requirements);
      }

      console.log('\n📋 Verification result:');
      console.log(`   Valid: ${result.isValid}`);
      if (!result.isValid) {
        console.log(`   ❌ Reason: ${result.invalidReason}`);
      } else if (result.payer) {
        console.log(`   Payer: ${result.payer}`);
      }

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown verification error';
      console.error(`   ❌ Verification failed: ${message}`);
      return {
        isValid: false,
        invalidReason: message,
      };
    }
  }

  async settlePayment(payload: PaymentPayload): Promise<SettlementResult> {
    console.log('\n💰 Settling payment...');
    console.log(`   Network: ${this.requirements.network}`);
    console.log(
      `   Amount: ${this.requirements.maxAmountRequired} (micro units)`
    );
    console.log(`   Pay to: ${this.requirements.payTo}`);

    try {
      let result: SettlementResult;
      
      // Try facilitator first if configured, fallback to local settlement
      if (this.mode === 'facilitator') {
        try {
          result = await this.callFacilitator<SettlementResult>('settle', payload);
        } catch (facilitatorError: any) {
          console.warn(`⚠️ Facilitator settlement failed: ${facilitatorError.message}, falling back to local settlement`);
          result = await this.settleOnChain(payload, this.requirements);
        }
      } else {
        // Direct mode: use local settlement
        result = await this.settleOnChain(payload, this.requirements);
      }

      console.log('\n✅ Payment settlement result:');
      console.log(`   Success: ${result.success}`);
      console.log(`   Network: ${result.network}`);
      if (result.transaction) {
        console.log(`   Transaction: ${result.transaction}`);
        if (this.explorerUrl) {
          console.log(
            `   Explorer: ${this.explorerUrl}/tx/${result.transaction}`
          );
        }
      }
      if (result.payer) {
        console.log(`   Payer: ${result.payer}`);
      }
      if (result.errorReason) {
        console.log(`   Error: ${result.errorReason}`);
      }

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown settlement error';
      console.error(`   ❌ Settlement failed: ${message}`);
      return {
        success: false,
        network: this.requirements.network,
        errorReason: message,
      };
    }
  }

  private verifyPaymentLocally(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): VerifyResult {
    console.log('🔍 Local verification - examining payload structure...');
    console.log('   Payload keys:', Object.keys(payload));
    console.log('   Payload.payload type:', typeof payload.payload);
    
    const exactPayload = payload.payload as any;
    console.log('   Exact payload keys:', exactPayload ? Object.keys(exactPayload) : 'null');
    
    const authorization = exactPayload?.authorization;
    const signature = exactPayload?.signature;

    console.log('   Has authorization:', !!authorization);
    console.log('   Has signature:', !!signature);

    if (!authorization || !signature) {
      console.error('❌ Missing authorization or signature');
      console.error('   Authorization:', authorization);
      console.error('   Signature:', signature ? 'present' : 'missing');
      console.error('   Full payload:', JSON.stringify(payload, null, 2));
      return {
        isValid: false,
        invalidReason: 'Missing payment authorization data. Expected payload.payload.authorization and payload.payload.signature',
      };
    }

    if (payload.network !== requirements.network) {
      return {
        isValid: false,
        invalidReason: `Network mismatch: ${payload.network} vs ${requirements.network}`,
      };
    }

    if (
      authorization.to?.toLowerCase() !== requirements.payTo.toLowerCase()
    ) {
      return {
        isValid: false,
        invalidReason: 'Authorization recipient does not match payment requirement',
      };
    }

    try {
      const requiredAmount = BigInt(requirements.maxAmountRequired);
      const authorizedAmount = BigInt(authorization.value);
      if (authorizedAmount < requiredAmount) {
        return {
          isValid: false,
          invalidReason: 'Authorized amount is less than required amount',
        };
      }
    } catch {
      return {
        isValid: false,
        invalidReason: 'Invalid payment amount provided',
      };
    }

    const validAfterNum = Number(authorization.validAfter ?? 0);
    const validBeforeNum = Number(authorization.validBefore ?? 0);
    if (Number.isNaN(validAfterNum) || Number.isNaN(validBeforeNum)) {
      return {
        isValid: false,
        invalidReason: 'Invalid authorization timing fields',
      };
    }

    const now = Math.floor(Date.now() / 1000);
    if (validAfterNum > now) {
      return {
        isValid: false,
        invalidReason: 'Payment authorization is not yet valid',
      };
    }
    if (validBeforeNum <= now) {
      return {
        isValid: false,
        invalidReason: 'Payment authorization has expired',
      };
    }

    try {
      console.log('🔍 Verifying EIP-712 signature...');
      const domain = this.buildEip712Domain(requirements);
      console.log('   Domain:', JSON.stringify(domain, null, 2));
      console.log('   Authorization from:', authorization.from);
      console.log('   Authorization to:', authorization.to);
      console.log('   Authorization value:', authorization.value);
      
      const recovered = ethers.verifyTypedData(
        domain,
        TRANSFER_AUTH_TYPES,
        {
          from: authorization.from,
          to: authorization.to,
          value: authorization.value,
          validAfter: authorization.validAfter,
          validBefore: authorization.validBefore,
          nonce: authorization.nonce,
        },
        signature
      );

      console.log('   Recovered address:', recovered);
      console.log('   Expected address:', authorization.from);

      if (recovered.toLowerCase() !== authorization.from.toLowerCase()) {
        console.error('❌ Address mismatch');
        return {
          isValid: false,
          invalidReason: `Signature does not match payer address. Expected ${authorization.from}, got ${recovered}`,
        };
      }

      console.log('✅ Local verification successful!');
      return {
        isValid: true,
        payer: recovered,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ EIP-712 verification error:', errorMsg);
      console.error('   Error details:', error);
      return {
        isValid: false,
        invalidReason: `Signature verification failed: ${errorMsg}`,
      };
    }
  }

  private async settleOnChain(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettlementResult> {
    if (!this.settlementWallet) {
      return {
        success: false,
        network: requirements.network,
        errorReason: 'Settlement wallet not configured',
      };
    }

    const exactPayload = payload.payload as any;
    const authorization = exactPayload?.authorization;
    const signature = exactPayload?.signature;

    if (!authorization || !signature) {
      return {
        success: false,
        network: requirements.network,
        errorReason: 'Missing payment authorization data',
      };
    }

    try {
      // Validate and convert authorization parameters to correct types
      console.log('🔧 Preparing settlement transaction...');
      console.log(`   From: ${authorization.from}`);
      console.log(`   To: ${authorization.to}`);
      console.log(`   Value (raw): ${authorization.value}`);
      console.log(`   ValidAfter (raw): ${authorization.validAfter}`);
      console.log(`   ValidBefore (raw): ${authorization.validBefore}`);
      console.log(`   Nonce: ${authorization.nonce}`);

      // Validate required fields
      if (!authorization.value) {
        return {
          success: false,
          network: requirements.network,
          payer: authorization.from,
          errorReason: 'Missing authorization value',
        };
      }

      // Convert to BigInt for uint256 parameters
      let value: bigint;
      let validAfter: bigint;
      let validBefore: bigint;

      try {
        value = typeof authorization.value === 'string' 
          ? BigInt(authorization.value) 
          : BigInt(String(authorization.value));
        validAfter = authorization.validAfter 
          ? (typeof authorization.validAfter === 'string' 
              ? BigInt(authorization.validAfter) 
              : BigInt(authorization.validAfter))
          : 0n;
        validBefore = authorization.validBefore 
          ? (typeof authorization.validBefore === 'string' 
              ? BigInt(authorization.validBefore) 
              : BigInt(authorization.validBefore))
          : 0n;
      } catch (conversionError: any) {
        console.error('❌ Failed to convert authorization values:', conversionError);
        return {
          success: false,
          network: requirements.network,
          payer: authorization.from,
          errorReason: `Invalid authorization value format: ${conversionError.message}`,
        };
      }

      console.log(`   Value (converted): ${value.toString()}`);
      console.log(`   ValidAfter (converted): ${validAfter.toString()}`);
      console.log(`   ValidBefore (converted): ${validBefore.toString()}`);

      // Parse signature with error handling
      let parsedSignature: ethers.Signature;
      try {
        console.log('🔍 Parsing signature...');
        parsedSignature = ethers.Signature.from(signature);
        console.log(`   Signature v: ${parsedSignature.v}`);
        console.log(`   Signature r: ${parsedSignature.r}`);
        console.log(`   Signature s: ${parsedSignature.s}`);
      } catch (sigError: any) {
        console.error('❌ Failed to parse signature:', sigError.message);
        return {
          success: false,
          network: requirements.network,
          payer: authorization.from,
          errorReason: `Invalid signature format: ${sigError.message}`,
        };
      }

      // Create contract instance
      const usdcContract = new ethers.Contract(
        requirements.asset,
        [
          'function transferWithAuthorization(' +
            'address from,' +
            'address to,' +
            'uint256 value,' +
            'uint256 validAfter,' +
            'uint256 validBefore,' +
            'bytes32 nonce,' +
            'uint8 v,' +
            'bytes32 r,' +
            'bytes32 s' +
            ') external returns (bool)',
        ],
        this.settlementWallet
      );

      console.log('📤 Sending settlement transaction...');
      const tx = await usdcContract.transferWithAuthorization(
        authorization.from,
        authorization.to,
        value,
        validAfter,
        validBefore,
        authorization.nonce,
        parsedSignature.v,
        parsedSignature.r,
        parsedSignature.s
      );

      console.log(`⏳ Transaction sent: ${tx.hash}`);
      console.log('   Waiting for confirmation...');

      const receipt = await tx.wait();
      const success = receipt?.status === 1;

      if (success) {
        console.log(`✅ Settlement transaction confirmed: ${receipt.hash}`);
      } else {
        console.error(`❌ Settlement transaction reverted: ${receipt.hash}`);
      }

      return {
        success,
        transaction: receipt?.hash,
        network: requirements.network,
        payer: authorization.from,
        errorReason: success ? undefined : 'Transaction reverted',
      };
    } catch (error: any) {
      console.error('❌ Settlement error:', error);
      console.error('   Error type:', error?.constructor?.name);
      console.error('   Error message:', error?.message);
      
      // Extract more detailed error information
      let errorReason = 'Unknown settlement error';
      if (error instanceof Error) {
        errorReason = error.message;
        
        // Check for common error patterns
        const errorAny = error as any;
        
        if (error.message.includes('insufficient funds')) {
          errorReason = `Insufficient funds for gas. Settlement wallet needs native tokens (ETH) for ${this.network}.`;
        } else if (error.message.includes('nonce')) {
          errorReason = `Transaction nonce error: ${error.message}`;
        } else if (error.message.includes('revert') || errorAny.reason) {
          errorReason = `Contract revert: ${errorAny.reason || error.message}`;
        } else if (errorAny.code === 'ACTION_REJECTED') {
          errorReason = 'Transaction was rejected';
        } else if (errorAny.code === 'NETWORK_ERROR') {
          errorReason = 'Network error during settlement';
        }
      } else if (typeof error === 'string') {
        errorReason = error;
      }

      return {
        success: false,
        network: requirements.network,
        payer: authorization?.from,
        errorReason,
      };
    }
  }

  private getAtomicAmount(priceUsd: number): string {
    const atomicUnits = Math.floor(priceUsd * 1_000_000);
    return atomicUnits.toString();
  }

  private buildHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.facilitatorApiKey) {
      headers.Authorization = `Bearer ${this.facilitatorApiKey}`;
    }

    return headers;
  }

  private async callFacilitator<T>(
    endpoint: 'verify' | 'settle',
    payload: PaymentPayload
  ): Promise<T> {
    if (!this.facilitatorUrl) {
      throw new Error('Facilitator URL is not configured.');
    }

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(`${this.facilitatorUrl}/${endpoint}`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          x402Version: payload.x402Version ?? 1,
          paymentPayload: payload,
          paymentRequirements: this.requirements,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Facilitator ${endpoint} failed (${response.status}): ${
            text || response.statusText
          }`
        );
      }

      return (await response.json()) as T;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Facilitator request timed out after 10 seconds');
      }
      throw new Error(`Facilitator request failed: ${fetchError.message}`);
    }
  }

  private buildEip712Domain(requirements: PaymentRequirements) {
    return {
      name: requirements.extra?.name || this.assetName,
      version: requirements.extra?.version || '2',
      chainId: this.chainId,
      verifyingContract: requirements.asset,
    };
  }

  private getDefaultRpcUrl(network: Network): string | undefined {
    switch (network) {
      case 'base':
        return 'https://mainnet.base.org';
      case 'base-sepolia':
        return 'https://sepolia.base.org';
      case 'polygon':
        return 'https://polygon-rpc.com';
      case 'polygon-amoy':
        return 'https://rpc-amoy.polygon.technology';
      case 'avalanche':
        return 'https://api.avax.network/ext/bc/C/rpc';
      case 'avalanche-fuji':
        return 'https://api.avax-test.network/ext/bc/C/rpc';
      case 'iotex':
        return 'https://rpc.ankr.com/iotex';
      case 'sei':
        return 'https://sei-rpc.publicnode.com';
      case 'sei-testnet':
        return 'https://sei-testnet-rpc.publicnode.com';
      case 'peaq':
        return 'https://erpc.peaq.network';
      default:
        return undefined;
    }
  }
}

