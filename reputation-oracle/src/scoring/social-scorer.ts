/**
 * Social graph scoring module (Farcaster + Lens)
 * Weight: 35% of total reputation score
 */

import { SocialFactors, ScoreBreakdown } from '../types/reputation';
import { FarcasterDataSource } from '../data-sources/farcaster';
import { LensDataSource } from '../data-sources/lens';

export class SocialScorer {
  private farcasterDataSource: FarcasterDataSource;
  private lensDataSource: LensDataSource;

  constructor(
    farcasterDataSource: FarcasterDataSource,
    lensDataSource: LensDataSource
  ) {
    this.farcasterDataSource = farcasterDataSource;
    this.lensDataSource = lensDataSource;
  }

  /**
   * Calculate social reputation score (0-100)
   * Combines Farcaster and Lens data
   */
  async calculateScore(address: string): Promise<number> {
    const factors = await this.getSocialFactors(address);

    // TODO: Implement scoring algorithm
    // Farcaster (50% of social score):
    // - Followers: up to 25 points (logarithmic scale)
    // - Verified: +15 points
    // - Account age: up to 10 points
    //
    // Lens (50% of social score):
    // - Followers: up to 25 points (logarithmic scale)
    // - Verified: +15 points
    // - Publications: up to 10 points

    let farcasterScore = 0;
    const fc = factors.farcaster;

    // Farcaster scoring
    if (fc.accountAge > 0) {
      const followerPoints = Math.min(25, Math.log10(fc.followers + 1) * 8);
      farcasterScore += followerPoints;

      if (fc.verified) {
        farcasterScore += 15;
      }

      const agePoints = Math.min(10, (fc.accountAge / 365) * 10);
      farcasterScore += agePoints;
    }

    let lensScore = 0;
    const lens = factors.lens;

    // Lens scoring
    if (lens.publications > 0 || lens.followers > 0) {
      const followerPoints = Math.min(25, Math.log10(lens.followers + 1) * 8);
      lensScore += followerPoints;

      if (lens.verified) {
        lensScore += 15;
      }

      const publicationPoints = Math.min(10, Math.log10(lens.publications + 1) * 5);
      lensScore += publicationPoints;
    }

    // Combine: 50% Farcaster + 50% Lens
    const combinedScore = (farcasterScore * 0.5) + (lensScore * 0.5);

    return Math.min(100, Math.round(combinedScore));
  }

  /**
   * Get social factors from all sources
   */
  async getSocialFactors(address: string): Promise<SocialFactors> {
    const [farcaster, lens] = await Promise.all([
      this.farcasterDataSource.getSocialFactors(address),
      this.lensDataSource.getSocialFactors(address),
    ]);

    return {
      farcaster,
      lens,
    };
  }

  /**
   * Get score breakdown for social component
   */
  async getScoreBreakdown(address: string): Promise<ScoreBreakdown['social']> {
    const factors = await this.getSocialFactors(address);
    const score = await this.calculateScore(address);

    return {
      score,
      weight: 0.35,
      factors,
    };
  }
}

