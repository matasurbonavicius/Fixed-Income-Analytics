import { Result, ResultHelper } from "@domain/shared";
import { dayCountFraction } from "@domain/formulas";
import { MacaulayDurationZeroInput, DurationResult } from "./Duration.types";

/**
 * Calculate all duration metrics for a zero-coupon bond
 *
 * For zero-coupon bonds:
 * - Macaulay Duration = Time to Maturity (only one cash flow)
 * - Modified Duration = Macaulay Duration / (1 + yield)
 * - Dollar Duration = Modified Duration × Market Value
 *
 * @param input - Zero coupon bond parameters
 * @returns Result containing all three duration metrics
 */
export function calculateDurationZero(
  input: MacaulayDurationZeroInput
): Result<DurationResult> {
  // For zero-coupon bonds, Macaulay Duration equals time to maturity
  const yearsToMaturity = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );

  const macaulayDuration = yearsToMaturity;

  // Modified Duration = Macaulay Duration / (1 + yield)
  const modifiedDuration =
    macaulayDuration / (1 + input.discountRate.asDecimal);

  // Calculate Market Value = Face Value × Clean Price (as %)
  const marketValueResult = input.faceValue.multiplyByPercentage(input.cleanPrice);
  if (!marketValueResult.success) {
    return marketValueResult;
  }

  // Dollar Duration = Modified Duration × Market Value / 100
  const dollarDurationResult = marketValueResult.value.multiply(modifiedDuration / 100);
  if (!dollarDurationResult.success) {
    return dollarDurationResult;
  }

  return ResultHelper.success<DurationResult>({
    macaulayDuration,
    modifiedDuration,
    dollarDuration: dollarDurationResult.value,
  });
}