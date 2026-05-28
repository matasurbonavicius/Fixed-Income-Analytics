import { DayCountConvention } from "@domain/formulas";
import { Currency, Money, Percentage, UTCDate } from "@domain/valueObjects";
import { CouponPayment } from "@domain/formulas";

/**
 * Represents a single cash flow event
 */
export interface CashFlow {
  date: UTCDate;
  amount: Money;
  type: "COUPON" | "PRINCIPAL" | "INITIAL_OUTFLOW";
  description: string;
}

/**
 * Complete cash flow schedule for a bond
 */
export interface CashFlowSchedule {
  bondId: string;
  currency: Currency;
  settlementDate: UTCDate;
  cashFlows: CashFlow[];
  totalInflows: Money;
  totalOutflows: Money;
  netCashFlow: Money;
}

/**
 * Input for generating fixed rate bond cash flows
 */
export interface CashFlowFixedInput {
  bondId: string;
  faceValue: Money;
  fixedRate: Percentage;
  frequency: number;
  currency: Currency;
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  futureCoupons: CouponPayment[];
  dayCountConvention: DayCountConvention;
  dirtyPrice?: Money; // Include initial outflow if provided
}

/**
 * Input for generating zero coupon bond cash flows
 */
export interface CashFlowZeroInput {
  bondId: string;
  faceValue: Money;
  currency: Currency;
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  dirtyPrice?: Money; // Include initial outflow if provided
}

/**
 * Options for cash flow calculation
 */
export interface CashFlowOptions {
  includeInitialOutflow?: boolean; // Whether to include the purchase price as negative cash flow
}
