/**
 * Agent0 Feedback Client
 * Integrates with Agent0 SDK for feedback submission and retrieval
 * Uses local SDK integration
 */

import { ethers } from 'ethers';
import type { SDK } from './sdk';

export interface FeedbackData {
  agentId: string;
  score: number; // 0-100 (mandatory)
  tags?: string[];
  capability?: string; // MCP capability: "tools", "prompts", "resources"
  name?: string; // MCP tool/resource/prompt name
  skill?: string; // A2A skill
  task?: string; // A2A task
  context?: Record<string, any>;
  proofOfPayment?: {
    txHash: string;
    amount: string;
    asset: string;
  };
}

export class Agent0FeedbackClient {
  private sdk: SDK | null = null;
  private signer: ethers.Wallet | null = null;
  private privateKey?: string;
  private chainId: number;
  private rpcUrl: string;

  constructor(rpcUrl: string, chainId: number, privateKey?: string) {
    this.rpcUrl = rpcUrl;
    this.chainId = chainId;
    this.privateKey = privateKey;

    if (privateKey) {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, provider);
    }
  }

  /**
   * Initialize SDK
   */
  private async initializeSDK(): Promise<void> {
    if (this.sdk) return;

    // Import local SDK
    const { SDK } = await import('./sdk');

    const config: any = {
      chainId: this.chainId,
      rpcUrl: this.rpcUrl,
    };

    // Pass private key if available (needed for submitting feedback)
    if (this.privateKey) {
      config.signer = this.privateKey;
    }

    this.sdk = new SDK(config);
  }

  /**
   * Prepare feedback file (doesn't submit on-chain)
   */
  async prepareFeedback(data: FeedbackData): Promise<any> {
    await this.initializeSDK();
    
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    // Call SDK prepareFeedback with correct signature
    return this.sdk.prepareFeedback(
      data.agentId,
      data.score,
      data.tags,
      undefined, // text
      data.capability,
      data.name,
      data.skill,
      data.task,
      data.context,
      data.proofOfPayment
    );
  }

  /**
   * Submit feedback on-chain (requires signer)
   */
  async giveFeedback(data: FeedbackData, feedbackAuth?: string): Promise<string> {
    await this.initializeSDK();
    
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    if (!this.signer) {
      throw new Error('Private key required for submitting feedback');
    }

    // Prepare feedback file
    const feedbackFile = await this.prepareFeedback(data);

    // Submit on-chain using SDK method
    const result = await this.sdk.giveFeedback(
      data.agentId,
      feedbackFile,
      feedbackAuth
    );

    // SDK returns Feedback object, extract ID
    const feedbackId = Array.isArray(result.id) 
      ? `${result.id[0]}:${result.id[1]}:${result.id[2]}` // Format: "agentId:clientAddress:feedbackIndex"
      : (result as any).id || `feedback-${Date.now()}`;
    
    return feedbackId;
  }

  /**
   * Get feedback by ID
   */
  async getFeedback(feedbackId: string): Promise<any> {
    await this.initializeSDK();
    
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    // Parse feedback ID format: "agentId:clientAddress:feedbackIndex"
    const parts = feedbackId.split(':');
    if (parts.length < 3) {
      throw new Error('Invalid feedback ID format');
    }

    const agentId = `${parts[0]}:${parts[1]}`;
    const clientAddress = parts[2];
    const feedbackIndex = parseInt(parts[3] || '0', 10);

    const feedback = await this.sdk.getFeedback(agentId, clientAddress, feedbackIndex);
    return feedback;
  }

  /**
   * Search feedback
   */
  async searchFeedback(params: {
    agentId: string;
    tags?: string[];
    capabilities?: string[];
    skills?: string[];
    minScore?: number;
    maxScore?: number;
  }): Promise<any[]> {
    await this.initializeSDK();
    
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    const results = await this.sdk.searchFeedback(
      params.agentId,
      params.tags,
      params.capabilities,
      params.skills,
      params.minScore,
      params.maxScore
    );

    return results || [];
  }

  /**
   * Get reputation summary
   */
  async getReputationSummary(agentId: string): Promise<any> {
    await this.initializeSDK();
    
    if (!this.sdk) {
      throw new Error('SDK not initialized');
    }

    const summary = await this.sdk.getReputationSummary(agentId);
    return summary;
  }
}


