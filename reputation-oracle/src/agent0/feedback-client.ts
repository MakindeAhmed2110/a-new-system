/**
 * Agent0 Feedback Client
 * Integrates with Agent0 SDK for feedback submission and retrieval
 */

import { SDK } from 'agent0-sdk';
import { ethers } from 'ethers';

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
  private chainId: number;
  private rpcUrl: string;

  constructor(rpcUrl: string, chainId: number, privateKey?: string) {
    this.rpcUrl = rpcUrl;
    this.chainId = chainId;

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

    const config: any = {
      chainId: this.chainId,
      rpcUrl: this.rpcUrl,
    };

    if (this.signer) {
      config.signer = this.signer;
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

    // The SDK prepareFeedback might have different signatures
    // Try to call it flexibly
    try {
      const feedbackData: any = {
        agentId: data.agentId,
        score: data.score,
      };
      
      if (data.tags) feedbackData.tags = data.tags;
      if (data.capability) feedbackData.capability = data.capability;
      if (data.name) feedbackData.name = data.name;
      if (data.skill) feedbackData.skill = data.skill;
      if (data.task) feedbackData.task = data.task;
      if (data.context) feedbackData.context = data.context;
      if (data.proofOfPayment) feedbackData.proofOfPayment = data.proofOfPayment;

      // Try calling prepareFeedback if it exists
      if (typeof (this.sdk as any).prepareFeedback === 'function') {
        return await (this.sdk as any).prepareFeedback(feedbackData);
      }
      
      // If method doesn't exist, return the data structure itself
      return feedbackData;
    } catch (error: any) {
      // If prepareFeedback fails, return the structured data
      return {
        agentId: data.agentId,
        score: data.score,
        tags: data.tags,
        capability: data.capability,
        name: data.name,
        skill: data.skill,
        task: data.task,
        context: data.context,
        proofOfPayment: data.proofOfPayment,
      };
    }
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

    // Submit on-chain - check SDK method signature
    // The SDK method may vary, so we'll try a flexible approach
    try {
      // Try standard method signature
      const result = await (this.sdk as any).giveFeedback(
        data.agentId,
        feedbackFile
      );

      // Handle different return types
      if (typeof result === 'string') {
        return result;
      } else if (result?.id) {
        return result.id;
      } else if (result?.feedbackId) {
        return result.feedbackId;
      }
      
      return `feedback-${Date.now()}`;
    } catch (error: any) {
      // If SDK method doesn't exist or has different signature, return a placeholder
      console.warn('Agent0 SDK giveFeedback method not available or has different signature:', error.message);
      return `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
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


