/**
 * On-chain transaction pattern scoring module
 * Weight: 30% of total reputation score
 */

import { OnChainFactors, ScoreBreakdown } from '../types/reputation';
import { BlockchainDataSource } from '../data-sources/blockchain';

export class OnChainScorer {
  private blockchainDataSource: BlockchainDataSource;

  constructor(blockchainDataSource: BlockchainDataSource) {
    this.blockchainDataSource = blockchainDataSource;
  }

  /**
   * Calculate on-chain reputation score (0-100)
   */
  async calculateScore(address: string): Promise<number> {
    const factors = await this.blockchainDataSource.getOnChainFactors(address);

    // TODO: Implement scoring algorithm
    // Factors to consider:
    // - Transaction count: up to 25 points (more activity = better, but diminishing returns)
    // - Unique counterparties: up to 20 points (diversity = better)
    // - Total volume: up to 15 points (normalized logarithmically)
    // - Transaction frequency: up to 15 points (consistent activity = better)
    // - Contract interactions: up to 15 points (more protocols = better)
    // - DApp diversity: up to 10 points (more unique protocols = better)

    let score = 0;

    // Transaction count (logarithmic scale, up to 25 points)
    const txCountPoints = Math.min(25, Math.log10(factors.transactionCount + 1) * 8);
    score += txCountPoints;

    // Unique counterparties (up to 20 points)
    const counterpartyPoints = Math.min(20, Math.min(factors.uniqueCounterparties / 10, 1) * 20);
    score += counterpartyPoints;

    // Total volume (logarithmic scale, up to 15 points)
    // Normalize to ETH equivalent (assuming USDC)
    const volumeETH = Number(factors.totalVolume) / 1e6 / 3000; // Rough ETH conversion
    const volumePoints = Math.min(15, Math.log10(volumeETH + 1) * 5);
    score += volumePoints;

    // Transaction frequency (up to 15 points)
    // Ideal: 10-50 transactions per month
    const frequencyPoints = Math.min(15, Math.min(factors.transactionFrequency / 10, 1) * 15);
    score += frequencyPoints;

    // Contract interactions (up to 15 points)
    const contractPoints = Math.min(15, factors.contractInteractions * 3);
    score += contractPoints;

    // DApp diversity (up to 10 points)
    const diversityPoints = Math.min(10, factors.dappDiversity * 2);
    score += diversityPoints;

    return Math.min(100, Math.round(score));
  }

  /**
   * Get score breakdown for on-chain component
   */
  async getScoreBreakdown(address: string): Promise<ScoreBreakdown['onchain']> {
    const factors = await this.blockchainDataSource.getOnChainFactors(address);
    const score = await this.calculateScore(address);

    return {
      score,
      weight: 0.30,
      factors,
    };
  }
}

