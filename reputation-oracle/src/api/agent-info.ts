/**
 * Agent Information API
 * Provides combined Agent0 + reputation information
 */

import { Request, Response } from 'express';
import { Agent0DataFetcher, Agent0Info } from '../agent0/data-fetcher';
import { ReputationAggregator } from '../scoring/aggregator';

export class AgentInfoHandler {
  private agent0DataFetcher: Agent0DataFetcher;
  private aggregator: ReputationAggregator;

  constructor(agent0DataFetcher: Agent0DataFetcher, aggregator: ReputationAggregator) {
    this.agent0DataFetcher = agent0DataFetcher;
    this.aggregator = aggregator;
  }

  /**
   * Get comprehensive agent information
   */
  async getAgentInfo(req: Request, res: Response): Promise<void> {
    try {
      const { agentId } = req.params;

      if (!agentId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameter: agentId',
        });
        return;
      }

      if (!Agent0DataFetcher.isValidAgentId(agentId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid Agent0 ID format. Expected format: "chainId:tokenId"',
        });
        return;
      }

      // Fetch Agent0 information
      const agent0Info = await this.agent0DataFetcher.getAgentInfo(agentId);

      if (!agent0Info) {
        res.status(404).json({
          success: false,
          error: `Agent not found: ${agentId}`,
        });
        return;
      }

      // Get wallet address
      const walletAddress = agent0Info.walletAddress;
      if (!walletAddress) {
        res.status(404).json({
          success: false,
          error: `Agent wallet address not found for: ${agentId}`,
        });
        return;
      }

      // Get reputation summary from Agent0 feedback system
      const reputationSummary = await this.agent0DataFetcher.getReputationSummary(agentId);

      // Calculate reputation score (if wallet address is available)
      let reputationScore = null;
      try {
        const queryId = `info-${Date.now()}`;
        reputationScore = await this.aggregator.calculateReputationScore(
          walletAddress,
          queryId,
          agentId
        );
      } catch (error) {
        console.warn('Could not calculate reputation score:', error);
        // Continue without reputation score
      }

      // Build response
      const response: any = {
        success: true,
        agentId,
        agent0: {
          name: agent0Info.name,
          description: agent0Info.description,
          image: agent0Info.image,
          active: agent0Info.active,
          x402support: agent0Info.x402support,
          walletAddress: agent0Info.walletAddress,
          walletChainId: agent0Info.walletChainId,
          endpoints: {
            mcp: agent0Info.mcpEndpoint,
            a2a: agent0Info.a2aEndpoint,
            ens: agent0Info.ensEndpoint,
          },
          capabilities: {
            mcpTools: agent0Info.mcpTools || [],
            mcpPrompts: agent0Info.mcpPrompts || [],
            mcpResources: agent0Info.mcpResources || [],
            a2aSkills: agent0Info.a2aSkills || [],
          },
          trustModels: agent0Info.trustModels || [],
          metadata: agent0Info.metadata || {},
          updatedAt: agent0Info.updatedAt,
        },
      };

      // Add reputation data
      if (reputationSummary) {
        response.reputation = {
          averageScore: reputationSummary.averageScore || null,
          totalFeedback: reputationSummary.totalFeedback || 0,
          scoreDistribution: reputationSummary.scoreDistribution || {},
        };
      }

      // Add calculated reputation score
      if (reputationScore) {
        response.reputationScore = {
          score: reputationScore.score,
          breakdown: reputationScore.breakdown,
          timestamp: reputationScore.timestamp,
        };
      }

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error fetching agent info:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }

  /**
   * Search for agents
   */
  async searchAgents(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        mcp,
        a2a,
        active,
        x402support,
        mcpTools,
        a2aSkills,
        supportedTrust,
        ens,
      } = req.query;

      const params: any = {};

      if (name) params.name = name as string;
      if (mcp === 'true') params.mcp = true;
      if (a2a === 'true') params.a2a = true;
      if (active !== undefined) params.active = active === 'true';
      if (x402support === 'true') params.x402support = true;
      if (mcpTools) {
        params.mcpTools = Array.isArray(mcpTools) ? mcpTools : [mcpTools];
      }
      if (a2aSkills) {
        params.a2aSkills = Array.isArray(a2aSkills) ? a2aSkills : [a2aSkills];
      }
      if (supportedTrust) {
        params.supportedTrust = Array.isArray(supportedTrust)
          ? supportedTrust
          : [supportedTrust];
      }
      if (ens) params.ens = ens as string;

      const agents = await this.agent0DataFetcher.searchAgents(params);

      res.status(200).json({
        success: true,
        agents,
        count: agents.length,
      });
    } catch (error: any) {
      console.error('Error searching agents:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }
}


