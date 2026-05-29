import { Result, ResultHelper } from "@domain/shared";
import { Money, Currency, UTCDate, Percentage } from "@domain/valueObjects";
import { AccruedInterestResult } from "./AccruedInterest.types";

/**
 * Calculate accrued interest for zero coupon bonds
 *
 * Zero coupon bonds have no periodic interest payments,
 * so accrued interest is always zero.
 *
 * @internal
 */
export function calculateAccruedInterestZero(
  currency: Currency,
  settlementDate: UTCDate
): Result<AccruedInterestResult> {
  const zeroMoneyResult = Money.create(0, currency);
  if (!zeroMoneyResult.success) {
    return zeroMoneyResult;
  }
  const zeroPercentResult = Percentage.zero();
  if (!zeroPercentResult.success) {
    return zeroPercentResult;
  }

  return ResultHelper.success({
    amountMoney: zeroMoneyResult.value,
    amountPercent: zeroPercentResult.value,
    accruedDays: 0,
    periodStartDate: settlementDate,
    periodEndDate: settlementDate,
    settlementDate: settlementDate,
  });
}
