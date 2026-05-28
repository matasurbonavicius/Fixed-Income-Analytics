import { DayCountConvention } from "@domain/formulas";
import { CouponPayment } from "@domain/formulas";
import { Money, Currency, Percentage, UTCDate } from "@domain/valueObjects";

/**
 * Input for calculating Macaulay Duration for fixed rate bonds
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
 * Result containing all three duration metrics
 */
export interface DurationResult {
  macaulayDuration: number; // in years
  modifiedDuration: number; // price sensitivity
  dollarDuration: Money; // dollar change for 1% yield change
}

