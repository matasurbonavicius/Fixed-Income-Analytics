import { Result } from "@domain/shared";
import { Percentage } from "@domain/valueObjects";
import { dayCountFraction } from "@domain/formulas";
import { DirtyPriceFixedFromCurveInput } from "./DirtyPrice.types";

/**
 * Calculate dirty price for a fixed-rate bond by discounting each cash flow off
 * a {@link DiscountCurve}.
 *
 * Same present-value sum as {@link calculateDirtyPriceFixedFromYield}, but the
 * flat factor `1/(1 + y/f)^n` is replaced by the curve's discount factor at the
 * cash flow's time:
 *
 *   P = Σ_k  CF_k · DF(t_k)
 *
 * where CF_k is the coupon (as % of par) and the final flow also carries the
 * 100%-of-par principal. Result is the dirty price as a percentage of par.
 *
 * @internal
 */
export function calculateDirtyPriceFixedFromCurve(
  input: DirtyPriceFixedFromCurveInput
): Result<Percentage> {
  // Coupon payment as % of par.
  const couponPaymentRateResult = input.fixedRate.divide(input.frequency);
  if (!couponPaymentRateResult.success) {
    return couponPaymentRateResult;
  }
  const couponPaymentRate = couponPaymentRateResult.value.asDecimal;

  let totalPV = 0;

  // PV of each coupon at the curve's DF(t).
  for (const coupon of input.futureCoupons) {
    const t = dayCountFraction(
      input.settlementDate,
      coupon.paymentDate,
      input.dayCountConvention
    );

    const dfResult = input.curve.discountFactor(t);
    if (!dfResult.success) {
      return dfResult;
    }

    totalPV += couponPaymentRate * dfResult.value;
  }

  // PV of principal (100% of par) at maturity.
  const tMaturity = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );
  const maturityDFResult = input.curve.discountFactor(tMaturity);
  if (!maturityDFResult.success) {
    return maturityDFResult;
  }
  totalPV += 1.0 * maturityDFResult.value;

  return Percentage.fromDecimal(totalPV);
}
