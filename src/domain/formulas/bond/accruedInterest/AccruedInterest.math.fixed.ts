import { dayCountFraction } from "@domain/formulas";
import {
  AccruedInterestFixedInput,
  AccruedInterestResult,
} from "./AccruedInterest.types";
import { Result, ResultHelper } from "@domain/shared";

/** @internal */
export function calculateAccruedInterestFixed(
  input: AccruedInterestFixedInput
): Result<AccruedInterestResult> {
  // Calculate coupon payment rate as % of par
  const couponPaymentRateResult = input.fixedRate.divide(input.frequency);
  if (!couponPaymentRateResult.success) {
    return couponPaymentRateResult;
  }
  const couponPaymentRate = couponPaymentRateResult.value;

  // Calculate accrued fraction (from period start to settlement)
  const accruedFraction = dayCountFraction(
    input.periodStartDate,
    input.settlementDate,
    input.dayCountConvention,
  );

  // Calculate total period fraction (from period start to period end)
  const totalPeriodFraction = dayCountFraction(
    input.periodStartDate,
    input.periodEndDate,
    input.dayCountConvention,
  );

  // Calculate accrued interest as % of par
  const accruedAmountPercentResult = couponPaymentRate.multiply(
    accruedFraction / totalPeriodFraction
  );
  if (!accruedAmountPercentResult.success) {
    return accruedAmountPercentResult;
  }
  const accruedAmountPercent = accruedAmountPercentResult.value;

  // Convert to money terms
  const accruedAmountMoneyResult = input.faceValue.multiplyByPercentage(
    accruedAmountPercent
  );
  if (!accruedAmountMoneyResult.success) {
    return accruedAmountMoneyResult;
  }

  // Calculate actual days accrued
  const accruedDays = input.periodStartDate.daysUntil(input.settlementDate);

  return ResultHelper.success({
    amountMoney: accruedAmountMoneyResult.value,
    amountPercent: accruedAmountPercent,
    accruedDays,
    periodStartDate: input.periodStartDate,
    periodEndDate: input.periodEndDate,
    settlementDate: input.settlementDate,
  });
}