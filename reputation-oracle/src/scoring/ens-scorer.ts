/**
 * ENS (Ethereum Name Service) scoring module
 * Weight: 20% of total reputation score
 */

import { ENSFactors, ScoreBreakdown } from '../types/reputation';
import { ENSDataSource } from '../data-sources/ens';

export class ENSScorer {
  private ensDataSource: ENSDataSource;

  constructor(ensDataSource: ENSDataSource) {
    this.ensDataSource = ensDataSource;
  }

  /**
   * Calculate ENS reputation score (0-100)
   */
  async calculateScore(address: string): Promise<number> {
    const factors = await this.ensDataSource.getENSFactors(address);

    // TODO: Implement scoring algorithm
    // Factors to consider:
    // - Reverse resolution: +30 points if present
    // - Primary name: +20 points if present
    // - Account age: up to 20 points (older = better)
    // - Linked addresses: up to 15 points (more connections = better)
    // - Resolution history: up to 15 points (stability = better)

    let score = 0;

    // Reverse resolution bonus
    if (factors.hasReverseResolution) {
      score += 30;
    }

    // Primary name bonus
    if (factors.hasPrimaryName) {
      score += 20;
    }

    // Account age (normalized to 0-20 points)
    const agePoints = Math.min(20, (factors.accountAge / 365) * 10);
    score += agePoints;

    // Linked addresses (normalized to 0-15 points)
    const linkedPoints = Math.min(15, factors.linkedAddresses * 3);
    score += linkedPoints;

    // Resolution stability (less changes = better, up to 15 points)
    const stabilityPoints = Math.max(0, 15 - factors.resolutionHistory * 2);
    score += stabilityPoints;

    return Math.min(100, Math.round(score));
  }

  /**
   * Get score breakdown for ENS component
   */
  async getScoreBreakdown(address: string): Promise<ScoreBreakdown['ens']> {
    const factors = await this.ensDataSource.getENSFactors(address);
    const score = await this.calculateScore(address);

    return {
      score,
      weight: 0.20,
      factors,
    };
  }
}

