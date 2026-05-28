import {
  Currency,
  CurrencyPair,
  Percentage,
  CreditRating,
  UTCDate,
  BondId,
} from "@domain/valueObjects";

export interface YieldCurve {
  currency: Currency;
  points: Array<{
    tenor: number; // years (e.g., 0.25 = 3 months, 1 = 1 year, 10 = 10 years)
    rate: Percentage;
  }>;
}

export interface CreditSpreadData {
  rating: CreditRating;
  currency: Currency;
  spread: number; // decimal (e.g., 0.001 = 10bps)
}

export interface FXRate {
  pair: CurrencyPair;
  rate: number;
}

export interface CleanBondPrice {
  bondId: BondId;
  priceType: "clean";
  bid: Percentage;
  ask?: Percentage;
}

export interface DirtyBondPrice {
  bondId: BondId;
  priceType: "dirty";
  bid: Percentage;
  ask?: Percentage;
}

export type BondPrice = CleanBondPrice | DirtyBondPrice;

export interface InternalRatingSpread {
  id: string; // UUID matching bond.internalRatingId
  name: string; // "BBB-equivalent", "High Risk", etc.
  spreadBps: number; // Basis points: 150 = 1.5%
}

// One MarketData point refers to all Market Data for a single point in time
export interface MarketData {
  asOfDate: UTCDate;

  bondPrice?: BondPrice[]; // All bond prices
  yieldCurve?: YieldCurve[]; // All Yield curves
  creditSpread?: CreditSpreadData[]; // All Credit spreads
  fxRates?: FXRate[];
  internalRatingSpread?: InternalRatingSpread[]; // Configurable internal ratings
}
