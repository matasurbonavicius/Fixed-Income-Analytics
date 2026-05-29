import { DayCountConvention } from "@domain/formulas";
import { CouponPayment } from "@domain/formulas";
import { Money, Currency, Percentage, UTCDate } from "@domain/valueObjects";

/**
 * Input for calculating Macaulay Duration for fixed rate bonds
 */
/**
 * @category Results & Types
 */
export interface MacaulayDurationFixedInput {
  faceValue: Money;
  fixedRate: Percentage;
  frequency: number;
  yield: Percentage;
  currency: Currency;
  cleanPrice: Percentage;
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  futureCoupons: CouponPayment[];
  dayCountConvention: DayCountConvention;
  compoundingFrequency?: number; // Defaults to payment frequency
}

/**
 * Input for calculating Macaulay Duration for zero coupon bonds
 */
/**
 * @category Results & Types
 */
export interface MacaulayDurationZeroInput {
  analyticalCurrency: Currency,
  faceValue: Money;
  currency: Currency;
  cleanPrice: Percentage;
  discountRate: Percentage;
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  dayCountConvention: DayCountConvention;
}

/**
 * Result containing the duration and convexity metrics
 */
/**
 * @category Results & Types
 */
export interface DurationResult {
  macaulayDuration: number; // in years
  modifiedDuration: number; // price sensitivity
  dollarDuration: Money; // dollar change for 1% yield change
  convexity: number; // second-order price sensitivity, in years²
  dollarConvexity: Money; // money change from the convexity term per 100bp²
}

