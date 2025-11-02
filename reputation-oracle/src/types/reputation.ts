/**
 * Type definitions for Reputation Scoring Oracle
 */

export interface ReputationScore {
  score: number; // 0-100
  breakdown: ScoreBreakdown;
  timestamp: number;
  address: string;
  metadata?: ReputationMetadata;
}

export interface ScoreBreakdown {
  ens: {
    score: number;
    weight: number;
    factors: ENSFactors;
  };
  onchain: {
    score: number;
    weight: number;
    factors: OnChainFactors;
  };
  walletAge: {
    score: number;
    weight: number;
    factors: WalletAgeFactors;
  };
  social: {
    score: number;
    weight: number;
    factors: SocialFactors;
  };
}

export interface ENSFactors {
  hasReverseResolution: boolean;
  hasPrimaryName: boolean;
  accountAge: number; // days since first transaction
  linkedAddresses: number;
  resolutionHistory: number; // number of changes
}

export interface OnChainFactors {
  transactionCount: number;
  uniqueCounterparties: number;
  totalVolume: bigint;
  transactionFrequency: number; // transactions per month
  contractInteractions: number;
  dappDiversity: number; // unique protocols interacted with
}

export interface WalletAgeFactors {
  firstTransactionTimestamp: number;
  ageInDays: number;
  accountTenure: 'new' | 'established' | 'veteran';
}

export interface SocialFactors {
  farcaster: {
    followers: number;
    following: number;
    verified: boolean;
    accountAge: number;
    casts: number;
  };
  lens: {
    followers: number;
    following: number;
    verified: boolean;
    publications: number;
  };
}

export interface ReputationMetadata {
  queryId: string;
  queriedBy: string; // Agent ID or address
  paymentTxHash?: string;
  cached: boolean;
  cacheAge?: number;
}

export interface ReputationQuery {
  address: string;
  agentId?: string; // Optional Agent0 agent ID
  requesterAddress?: string;
  paymentPayload?: any; // x402 payment payload
}

export interface ReputationResponse {
  success: boolean;
  score?: ReputationScore;
  error?: string;
  message?: string;
}

// Scoring weights configuration
export interface ScoringWeights {
  ens: number; // Default: 0.20
  onchain: number; // Default: 0.30
  walletAge: number; // Default: 0.15
  social: number; // Default: 0.35
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  ens: 0.20,
  onchain: 0.30,
  walletAge: 0.15,
  social: 0.35,
};

// Account tenure thresholds
export const TENURE_THRESHOLDS = {
  new: 90, // days
  established: 365, // days
  veteran: 730, // days
};

