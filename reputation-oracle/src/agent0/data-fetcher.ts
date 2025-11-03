/**
 * Agent0 Data Fetcher
 * Fetches agent information from Agent0 registry/subgraph
 */

import { SDK } from 'agent0-sdk';
import { ethers } from 'ethers';

export interface Agent0Info {
  agentId: string;
  name: string;
  description: string;
  image?: string;
  active: boolean;
  x402support: boolean;
  walletAddress?: string;
  walletChainId?: number;
  mcpEndpoint?: string;
  a2aEndpoint?: string;
  ensEndpoint?: string;
  mcpTools?: string[];
  mcpPrompts?: string[];
  mcpResources?: string[];
  a2aSkills?: string[];
  trustModels?: string[];
  metadata?: Record<string, any>;
  owners?: string[];
  operators?: string[];
  updatedAt?: number;
}

export class Agent0DataFetcher {
  private sdk: SDK | null = null;
  private rpcUrl: string;
  private chainId: number;

  constructor(rpcUrl: string, chainId: number) {
    this.rpcUrl = rpcUrl;
    this.chainId = chainId;
  }

  /**
   * Initialize SDK (read-only mode, no signer needed)
   */
  private async initializeSDK(): Promise<void> {
    if (this.sdk) return;

    this.sdk = new SDK({
      chainId: this.chainId,
      rpcUrl: this.rpcUrl,
      // No signer needed for read-only operations
    });
  }

  /**
   * Get agent information by Agent0 ID
   * Format: "chainId:tokenId" (e.g., "84532:123")
   */
  async getAgentInfo(agentId: string): Promise<Agent0Info | null> {
    try {
      await this.initializeSDK();
      
      if (!this.sdk) {
        throw new Error('SDK not initialized');
      }

      // Get agent summary from subgraph (fast)
      const agentSummary = await this.sdk.getAgent(agentId);
      
      if (!agentSummary) {
        return null;
      }

      // Convert to our format
      // Note: AgentSummary properties may vary - accessing safely
      const info: Agent0Info = {
        agentId: agentSummary.agentId || agentId,
        name: agentSummary.name || 'Unknown',
        description: agentSummary.description || '',
        image: (agentSummary as any).image,
        active: agentSummary.active ?? true,
        x402support: agentSummary.x402support ?? false,
        walletAddress: (agentSummary as any).walletAddress,
        walletChainId: (agentSummary as any).walletChainId,
        mcpEndpoint: (agentSummary as any).mcpEndpoint,
        a2aEndpoint: (agentSummary as any).a2aEndpoint,
        ensEndpoint: (agentSummary as any).ensEndpoint,
        mcpTools: agentSummary.mcpTools,
        mcpPrompts: agentSummary.mcpPrompts,
        mcpResources: agentSummary.mcpResources,
        a2aSkills: agentSummary.a2aSkills,
      };

      return info;
    } catch (error: any) {
      console.error(`Error fetching agent info for ${agentId}:`, error.message);
      return null;
    }
  }

  /**
   * Get agent wallet address from Agent0 ID
   */
  async getAgentWalletAddress(agentId: string): Promise<string | null> {
    const info = await this.getAgentInfo(agentId);
    return info?.walletAddress || null;
  }

  /**
   * Search for agents
   */
  async searchAgents(params: {
    name?: string;
    mcp?: boolean;
    a2a?: boolean;
    active?: boolean;
    x402support?: boolean;
    mcpTools?: string[];
    a2aSkills?: string[];
    supportedTrust?: string[];
    ens?: string;
  }): Promise<any[]> {
    try {
      await this.initializeSDK();
      
      if (!this.sdk) {
        throw new Error('SDK not initialized');
      }

      const results = await this.sdk.searchAgents(params);
      return results.items || [];
    } catch (error: any) {
      console.error('Error searching agents:', error.message);
      return [];
    }
  }

  /**
   * Get reputation summary from Agent0 feedback system
   */
  async getReputationSummary(agentId: string): Promise<any | null> {
    try {
      await this.initializeSDK();
      
      if (!this.sdk) {
        throw new Error('SDK not initialized');
      }

      const summary = await this.sdk.getReputationSummary(agentId);
      return summary;
    } catch (error: any) {
      console.error(`Error fetching reputation summary for ${agentId}:`, error.message);
      return null;
    }
  }

  /**
   * Parse Agent0 ID format
   * Returns { chainId, tokenId } or null if invalid
   */
  static parseAgentId(agentId: string): { chainId: number; tokenId: number } | null {
    const parts = agentId.split(':');
    if (parts.length !== 2) {
      return null;
    }

    const chainId = parseInt(parts[0], 10);
    const tokenId = parseInt(parts[1], 10);

    if (isNaN(chainId) || isNaN(tokenId)) {
      return null;
    }

    return { chainId, tokenId };
  }

  /**
   * Validate Agent0 ID format
   */
  static isValidAgentId(agentId: string): boolean {
    return this.parseAgentId(agentId) !== null;
  }
}

