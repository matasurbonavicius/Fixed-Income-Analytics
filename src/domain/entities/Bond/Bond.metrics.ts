import { Percentage, UTCDate } from "@domain/valueObjects";
import { CashFlowSchedule, DurationResult, DiscountRateResult, AccruedInterestResult } from "@domain/formulas";

/**
 * @category Bond Types & Shapes
 */
export interface BondMetrics {
  bondId: string;
  calculationDate: UTCDate;

  // === DISCOUNT RATE ===
  discountRate?: DiscountRateResult;

  // === PRICE & VALUATION ===
  cleanPrice?: Percentage;
  dirtyPrice?: Percentage;
  accruedInterest?: AccruedInterestResult;

  // === CASH FLOWS ===
  cashFlows?: CashFlowSchedule;

  // === DURATION & CONVEXITY ===
  duration?: DurationResult; // carries Macaulay/modified/dollar duration plus convexity

  // Need to add current yield
}
