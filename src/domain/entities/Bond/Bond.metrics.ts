import { Percentage, UTCDate } from "@domain/valueObjects";
import { CashFlowSchedule, DurationResult, DiscountRateResult, AccruedInterestResult, SpreadsResult } from "@domain/formulas";

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

  // === SPREADS (curve-relative) ===
  spreads?: SpreadsResult; // Z-spread (headline) plus I-spread and optional G-spread

  // Need to add current yield
}
