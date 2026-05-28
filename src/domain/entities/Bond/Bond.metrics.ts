import { Percentage, UTCDate } from "@domain/valueObjects";
import { CashFlowSchedule, DurationResult, DiscountRateResult, AccruedInterestResult } from "@domain/formulas";

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
  duration?: DurationResult;

  // Need to add current yield
}
