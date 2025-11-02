/**
 * Wallet age scoring module
 * Weight: 15% of total reputation score
 */

import { WalletAgeFactors, ScoreBreakdown, TENURE_THRESHOLDS } from '../types/reputation';
import { BlockchainDataSource } from '../data-sources/blockchain';

export class WalletAgeScorer {
  private blockchainDataSource: BlockchainDataSource;

  constructor(blockchainDataSource: BlockchainDataSource) {
    this.blockchainDataSource = blockchainDataSource;
  }

  /**
   * Calculate wallet age reputation score (0-100)
   */
  async calculateScore(address: string): Promise<number> {
    const factors = await this.getWalletAgeFactors(address);

    // TODO: Implement scoring algorithm
    // Age scoring:
    // - New (< 90 days): 0-30 points
    // - Established (90-365 days): 30-70 points
    // - Veteran (365+ days): 70-100 points
    // Linear progression within each tier

    let score = 0;

    if (factors.accountTenure === 'veteran') {
      // Veteran: 70-100 points
      const daysOverVeteran = factors.ageInDays - TENURE_THRESHOLDS.veteran;
      const veteranProgress = Math.min(1, daysOverVeteran / 365); // Max out after 2 years
      score = 70 + Math.round(veteranProgress * 30);
    } else if (factors.accountTenure === 'established') {
      // Established: 30-70 points
      const daysInTier = factors.ageInDays - TENURE_THRESHOLDS.new;
      const tierRange = TENURE_THRESHOLDS.established - TENURE_THRESHOLDS.new;
      const progress = daysInTier / tierRange;
      score = 30 + Math.round(progress * 40);
    } else {
      // New: 0-30 points
      const progress = factors.ageInDays / TENURE_THRESHOLDS.new;
      score = Math.round(progress * 30);
    }

    return Math.min(100, score);
  }

  /**
   * Get wallet age factors
   */
  async getWalletAgeFactors(address: string): Promise<WalletAgeFactors> {
    const firstTxTimestamp = await this.blockchainDataSource.getFirstTransactionTimestamp(address);

    if (!firstTxTimestamp) {
      return {
        firstTransactionTimestamp: 0,
        ageInDays: 0,
        accountTenure: 'new',
      };
    }

    const ageInDays = Math.floor((Date.now() - firstTxTimestamp * 1000) / (1000 * 60 * 60 * 24));

    let accountTenure: 'new' | 'established' | 'veteran';
    if (ageInDays >= TENURE_THRESHOLDS.veteran) {
      accountTenure = 'veteran';
    } else if (ageInDays >= TENURE_THRESHOLDS.established) {
      accountTenure = 'established';
    } else {
      accountTenure = 'new';
    }

    return {
      firstTransactionTimestamp: firstTxTimestamp,
      ageInDays,
      accountTenure,
    };
  }

  /**
   * Get score breakdown for wallet age component
   */
  async getScoreBreakdown(address: string): Promise<ScoreBreakdown['walletAge']> {
    const factors = await this.getWalletAgeFactors(address);
    const score = await this.calculateScore(address);

    return {
      score,
      weight: 0.15,
      factors,
    };
  }
}

