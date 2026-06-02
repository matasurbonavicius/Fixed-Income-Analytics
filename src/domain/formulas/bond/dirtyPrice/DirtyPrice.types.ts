import { Money, Currency, Percentage, UTCDate, DiscountCurve } from "@domain/valueObjects";
import { DayCountConvention, CouponPayment } from "@domain/formulas";

// ZERO
/**
 * @category Results & Types
 */
export interface DirtyPriceZeroFromYieldInput {
  faceValue: Money;
  currency: Currency;
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  discountRate: Percentage;
  dayCountConvention: DayCountConvention;
  compoundingFrequency: number;
}

// FIXED
/**
 * @category Results & Types
 */
export interface DirtyPriceFixedFromYieldInput {
  faceValue: Money;
  fixedRate: Percentage;
  frequency: number;
  currency: Currency;
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  futureCoupons: CouponPayment[];
  discountRate: Percentage;
  dayCountConvention: DayCountConvention;
  compoundingFrequency: number;
}

// ===== FROM CURVE (opt-in curve discounting) =====

/**
 * Input for pricing a zero-coupon bond off a {@link DiscountCurve} instead of
 * a flat yield: the single principal flow at maturity is discounted at the
 * curve's `DF(t)`.
 *
 * @category Results & Types
 */
export interface DirtyPriceZeroFromCurveInput {
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  curve: DiscountCurve;
  dayCountConvention: DayCountConvention;
}

/**
 * Input for pricing a fixed-rate bond off a {@link DiscountCurve}: every
 * future coupon and the principal are discounted at the curve's `DF(t_k)`
 * rather than at one flat `y/f`.
 *
 * @category Results & Types
 */
export interface DirtyPriceFixedFromCurveInput {
  fixedRate: Percentage;
  frequency: number;
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  futureCoupons: CouponPayment[];
  curve: DiscountCurve;
  dayCountConvention: DayCountConvention;
}
