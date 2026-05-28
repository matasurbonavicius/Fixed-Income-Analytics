import { DiscountRateMethod } from "@domain/entities";
import { Money, Percentage, UTCDate } from "@domain/valueObjects";
import { CouponPayment, DayCountConvention } from "@domain/formulas";

// Re-export for convenience
export type { DiscountRateMethod };

export const DEFAULT_DISCOUNT_RATE_METHODS: DiscountRateMethod[] = [
  "implied_from_price",
  "official_rating",
  "internal_rating",
  "manual_spread",
  "manual_rate",
];

/**
 * Options for discount rate calculation
 */
export interface DiscountRateOptions {
  methods?: DiscountRateMethod[]; // Methods to try, in order
}

/**
 * Result of discount rate calculation
 */
export interface DiscountRateResult {
  discountRate: Percentage;
  methodUsed: DiscountRateMethod;
}

// ============= INPUT TYPES FOR DOMAIN MATH =============

/**
 * Input for calculating implied discount rate from dirty price (zero coupon)
 * Note: For zero coupon bonds, dirty price = clean price (no accrued interest)
 */
export interface ImpliedRateZeroInput {
  faceValue: Money;
  cleanPrice: Percentage; // Named cleanPrice for backward compatibility, but represents dirty price
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  dayCountConvention: DayCountConvention;
}

/**
 * Input for calculating implied discount rate from dirty price (fixed rate)
 */
export interface ImpliedRateFixedInput {
  faceValue: Money;
  cleanPrice: Percentage; // Named cleanPrice for backward compatibility, but represents dirty price
  fixedRate: Percentage;
  frequency: number;
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  futureCoupons: CouponPayment[];
  dayCountConvention: DayCountConvention;
}
