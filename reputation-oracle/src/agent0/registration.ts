/**
 * Agent0 SDK Integration - Registration Module
 * Registers the reputation oracle as an agent on-chain (ERC-8004)
 */

import { SDK } from 'agent0-sdk';
import { ethers } from 'ethers';

export interface Agent0Config {
  privateKey: string;
  rpcUrl: string;
  chainId: number; // e.g., 84532 for Base Sepolia
  agentName: string;
  agentDescription: string;
  agentUrl: string; // Base URL of the oracle service
  ipfs?: {
    apiUrl?: string;
    apiKey?: string;
    provider?: 'node' | 'filecoinPin' | 'pinata';
    pinataJwt?: string;
    filecoinPrivateKey?: string;
  };
}

export class Agent0Registration {
  private sdk: SDK | null = null;
  private agent: any | null = null;
  private config: Agent0Config;
  private registeredAgentId: string | null = null;

  constructor(config: Agent0Config) {
    this.config = config;
  }

  /**
   * Initialize SDK and register agent
   */
  async initialize(): Promise<string> {
    try {
      console.log('🔧 Initializing Agent0 SDK...');

      // Initialize ethers signer
      const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      const signer = new ethers.Wallet(this.config.privateKey, provider);

      // Configure IPFS
      const ipfsConfig: any = {};
      if (this.config.ipfs?.provider === 'pinata' && this.config.ipfs.pinataJwt) {
        ipfsConfig.ipfs = 'pinata';
        ipfsConfig.pinataJwt = this.config.ipfs.pinataJwt;
      } else if (this.config.ipfs?.provider === 'filecoinPin' && this.config.ipfs.filecoinPrivateKey) {
        ipfsConfig.ipfs = 'filecoinPin';
        ipfsConfig.filecoinPrivateKey = this.config.ipfs.filecoinPrivateKey;
      } else if (this.config.ipfs?.apiUrl) {
        ipfsConfig.ipfs = 'node';
        ipfsConfig.ipfsNodeUrl = this.config.ipfs.apiUrl;
      }

      // Initialize SDK
      this.sdk = new SDK({
        chainId: this.config.chainId,
        rpcUrl: this.config.rpcUrl,
        signer: signer,
        ...ipfsConfig,
      });

      // Create agent
      console.log('📝 Creating agent...');
      this.agent = await this.sdk.createAgent(
        this.config.agentName,
        this.config.agentDescription,
        undefined // No image for now
      );

      // Set A2A (Agent-to-Agent) endpoint for x402 payments
      console.log('🔗 Setting A2A endpoint...');
      await this.agent.setA2A(this.config.agentUrl);

      // Enable x402 payment support
      console.log('💰 Enabling x402 payment support...');
      await this.agent.setX402Support(true);

      // Set trust models (reputation-based + crypto-economic)
      console.log('🛡️ Setting trust models...');
      await this.agent.setTrust({
        reputation: true,
        cryptoEconomic: true,
        teeAttestation: false,
      });

      // Set agent wallet (payment address)
      await this.agent.setAgentWallet(
        signer.address,
        this.config.chainId
      );

      // Set metadata with oracle-specific information
      console.log('📋 Setting metadata...');
      await this.agent.setMetadata({
        oracleType: 'reputation-scoring',
        version: '0.1.0',
        capabilities: {
          reputationScoring: true,
          x402Payments: true,
          activityTracking: true,
          feedbackSystem: true,
        },
        dataSources: ['ENS', 'Blockchain', 'Farcaster', 'Lens', 'Agent0'],
      });

      // Set agent as active
      console.log('✅ Activating agent...');
      await this.agent.setActive(true);

      // Register on-chain (IPFS + ERC-8004)
      console.log('📤 Registering agent on-chain...');
      const registrationFile = await this.agent.registerIPFS();
      
      // Get agent ID
      this.registeredAgentId = this.agent.agentId || null;

      console.log(`\n✅ Agent registered successfully!`);
      console.log(`🆔 Agent ID: ${this.registeredAgentId}`);
      console.log(`🌐 Agent URI: ${registrationFile.agentURI || 'N/A'}`);
      console.log(`🔗 Agent URL: ${this.config.agentUrl}`);
      
      return this.registeredAgentId || '';
    } catch (error: any) {
      console.error('❌ Failed to register with Agent0:', error.message);
      console.error(error);
      throw error;
    }
  }

  /**
   * Get the registered agent instance
   */
  async getAgent(): Promise<any> {
    if (!this.sdk || !this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }
    return this.agent;
  }

  /**
   * Get the SDK instance
   */
  getSDK(): SDK | null {
    return this.sdk;
  }

  /**
   * Update agent status
   */
  async setActive(active: boolean): Promise<void> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }
    await this.agent.setActive(active);
    console.log(`Agent ${active ? 'activated' : 'deactivated'}`);
  }

  /**
   * Get agent ID
   */
  getAgentId(): string | null {
    return this.registeredAgentId;
  }

  /**
   * Update agent information
   */
  async updateInfo(name?: string, description?: string): Promise<void> {
    if (!this.agent) {
      throw new Error('Agent not initialized');
    }
    
    await this.agent.updateInfo(name, description);
    
    // Re-register to update on-chain
    await this.agent.registerIPFS();
    console.log('Agent information updated');
  }
}





