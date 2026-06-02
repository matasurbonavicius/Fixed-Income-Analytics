import { Result } from "@domain/shared";
import { Percentage } from "@domain/valueObjects";
import { dayCountFraction } from "@domain/formulas";
import { DirtyPriceZeroFromCurveInput } from "./DirtyPrice.types";

/**
 * Calculate dirty price for a zero-coupon bond by discounting its single
 * principal flow off a {@link DiscountCurve}.
 *
 * Price (as % of par) = DF(t), where t is the time to maturity. The curve-side
 * analogue of {@link calculateDirtyPriceZeroFromYield}.
 *
 * @internal
 */
export function calculateDirtyPriceZeroFromCurve(
  input: DirtyPriceZeroFromCurveInput
): Result<Percentage> {
  const t = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );

  const dfResult = input.curve.discountFactor(t);
  if (!dfResult.success) {
    return dfResult;
  }

  return Percentage.fromDecimal(dfResult.value);
}
