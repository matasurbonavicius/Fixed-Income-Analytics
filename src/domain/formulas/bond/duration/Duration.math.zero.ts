import { Result, ResultHelper } from "@domain/shared";
import { dayCountFraction } from "@domain/formulas";
import { MacaulayDurationZeroInput, DurationResult } from "./Duration.types";

/**
 * Calculate all duration metrics for a zero-coupon bond
 *
 * For zero-coupon bonds (single cash flow, annual compounding):
 * - Macaulay Duration = Time to Maturity (only one cash flow)
 * - Modified Duration = Macaulay Duration / (1 + yield)
 * - Dollar Duration = Modified Duration × Market Value
 * - Convexity = t(t + 1) / (1 + yield)²
 * - Dollar Convexity = Convexity × Market Value
 *
 * @param input - Zero coupon bond parameters
 * @returns Result containing the duration and convexity metrics
 *
 * @internal
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
  const onePlusYield = 1 + input.discountRate.asDecimal;
  const modifiedDuration = macaulayDuration / onePlusYield;

  // Convexity = t(t + 1) / (1 + yield)²
  const convexity =
    (yearsToMaturity * (yearsToMaturity + 1)) / (onePlusYield * onePlusYield);

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

  // Dollar Convexity = Convexity × Market Value
  const dollarConvexityResult = marketValueResult.value.multiply(convexity);
  if (!dollarConvexityResult.success) {
    return dollarConvexityResult;
  }

  return ResultHelper.success<DurationResult>({
    macaulayDuration,
    modifiedDuration,
    dollarDuration: dollarDurationResult.value,
    convexity,
    dollarConvexity: dollarConvexityResult.value,
  });
}