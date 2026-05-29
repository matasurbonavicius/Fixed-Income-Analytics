import { DayCountConvention } from "@domain/formulas";
import { Money, Percentage, UTCDate } from "@domain/valueObjects";

/**
 * @category Results & Types
 */
export interface AccruedInterestFixedInput {
  faceValue: Money;
  fixedRate: Percentage;
  frequency: number;
  periodStartDate: UTCDate;
  periodEndDate: UTCDate;
  settlementDate: UTCDate;
  dayCountConvention: DayCountConvention;
}

/**
 * @category Results & Types
 */
export interface AccruedInterestResult {
  amountMoney: Money;
  amountPercent: Percentage;
  accruedDays: number;
  periodStartDate: UTCDate;
  periodEndDate: UTCDate;
  settlementDate: UTCDate;
}