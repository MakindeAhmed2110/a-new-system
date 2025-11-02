/**
 * Reputation score aggregator
 * Combines all scoring components into final 0-100 score
 */

import {
  ReputationScore,
  ScoreBreakdown,
  DEFAULT_WEIGHTS,
  ScoringWeights,
} from '../types/reputation';
import { ENSScorer } from './ens-scorer';
import { OnChainScorer } from './onchain-scorer';
import { WalletAgeScorer } from './wallet-age-scorer';
import { SocialScorer } from './social-scorer';

export class ReputationAggregator {
  private ensScorer: ENSScorer;
  private onChainScorer: OnChainScorer;
  private walletAgeScorer: WalletAgeScorer;
  private socialScorer: SocialScorer;
  private weights: ScoringWeights;

  constructor(
    ensScorer: ENSScorer,
    onChainScorer: OnChainScorer,
    walletAgeScorer: WalletAgeScorer,
    socialScorer: SocialScorer,
    weights: ScoringWeights = DEFAULT_WEIGHTS
  ) {
    this.ensScorer = ensScorer;
    this.onChainScorer = onChainScorer;
    this.walletAgeScorer = walletAgeScorer;
    this.socialScorer = socialScorer;
    this.weights = weights;
  }

  /**
   * Calculate final aggregated reputation score
   */
  async calculateReputationScore(
    address: string,
    queryId: string,
    queriedBy?: string
  ): Promise<ReputationScore> {
    // Calculate all component scores in parallel
    const [ensBreakdown, onChainBreakdown, walletAgeBreakdown, socialBreakdown] =
      await Promise.all([
        this.ensScorer.getScoreBreakdown(address),
        this.onChainScorer.getScoreBreakdown(address),
        this.walletAgeScorer.getScoreBreakdown(address),
        this.socialScorer.getScoreBreakdown(address),
      ]);

    const breakdown: ScoreBreakdown = {
      ens: ensBreakdown,
      onchain: onChainBreakdown,
      walletAge: walletAgeBreakdown,
      social: socialBreakdown,
    };

    // Weighted average calculation
    const finalScore =
      ensBreakdown.score * this.weights.ens +
      onChainBreakdown.score * this.weights.onchain +
      walletAgeBreakdown.score * this.weights.walletAge +
      socialBreakdown.score * this.weights.social;

    return {
      score: Math.round(finalScore),
      breakdown,
      timestamp: Date.now(),
      address,
      metadata: {
        queryId,
        queriedBy: queriedBy || 'unknown',
        cached: false,
      },
    };
  }

  /**
   * Get component breakdown without final score
   */
  async getBreakdown(address: string): Promise<ScoreBreakdown> {
    const [ens, onchain, walletAge, social] = await Promise.all([
      this.ensScorer.getScoreBreakdown(address),
      this.onChainScorer.getScoreBreakdown(address),
      this.walletAgeScorer.getScoreBreakdown(address),
      this.socialScorer.getScoreBreakdown(address),
    ]);

    return {
      ens,
      onchain,
      walletAge,
      social,
    };
  }
}

