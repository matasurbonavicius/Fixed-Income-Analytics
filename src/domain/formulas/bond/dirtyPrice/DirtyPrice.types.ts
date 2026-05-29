import { Money, Currency, Percentage, UTCDate } from "@domain/valueObjects";
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
