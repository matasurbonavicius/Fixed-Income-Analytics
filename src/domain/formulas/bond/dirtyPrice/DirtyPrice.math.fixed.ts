import { Result } from "@domain/shared";
import { Percentage } from "@domain/valueObjects";
import { dayCountFraction } from "@domain/formulas";
import {
  DirtyPriceFixedFromYieldInput,
} from "./DirtyPrice.types";

/**
 * Calculate dirty price for fixed rate from discount rate
 * Present value of all future cash flows as percentage of par
 *
 * @internal
 */
export function calculateDirtyPriceFixedFromYield(
  input: DirtyPriceFixedFromYieldInput
): Result<Percentage> {
  // Per-period discount rate
  const periodicRateResult = input.discountRate.divide(input.compoundingFrequency);
  if (!periodicRateResult.success) {
    return periodicRateResult;
  }
  const periodicRate = periodicRateResult.value;

  // If no future coupons, only principal remains (at 100% of par)
  if (input.futureCoupons.length === 0) {
    const yearsToMaturity = dayCountFraction(
      input.settlementDate,
      input.maturityDate,
      input.dayCountConvention
    );
    const numPeriods = input.compoundingFrequency * yearsToMaturity;

    // PV factor = 1 / (1 + r)^n
    const discountFactor = Math.pow(1 + periodicRate.asDecimal, numPeriods);
    const pvRatio = 1 / discountFactor;

    return Percentage.fromDecimal(pvRatio);
  }

  // Calculate coupon payment as percentage of par
  const couponPaymentRateResult = input.fixedRate.divide(input.frequency);
  if (!couponPaymentRateResult.success) {
    return couponPaymentRateResult;
  }
  const couponPaymentRate = couponPaymentRateResult.value;

  // Start with zero percentage
  const zeroPctResult = Percentage.zero();
  if (!zeroPctResult.success) {
    return zeroPctResult;
  }
  let totalPV = zeroPctResult.value;

  // PV of coupons (as % of par)
  for (let i = 0; i < input.futureCoupons.length; i++) {
    const coupon = input.futureCoupons[i];
    const timeToPayment = dayCountFraction(
      input.settlementDate,
      coupon.paymentDate,
      input.dayCountConvention
    );
    const numPeriods = input.compoundingFrequency * timeToPayment;

    // PV factor for this coupon
    const discountFactor = Math.pow(1 + periodicRate.asDecimal, numPeriods);
    const pvFactor = 1 / discountFactor;

    // PV of this coupon payment (as % of par)
    const couponPVResult = couponPaymentRate.multiply(pvFactor);
    if (!couponPVResult.success) {
      return couponPVResult;
    }

    const addResult = totalPV.add(couponPVResult.value);
    if (!addResult.success) {
      return addResult;
    }
    totalPV = addResult.value;
  }
  // PV of principal at maturity (principal is 100% of par)
  const timeToMaturity = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );
  const maturityPeriods = input.compoundingFrequency * timeToMaturity;

  const maturityDiscountFactor = Math.pow(1 + periodicRate.asDecimal, maturityPeriods);
  const principalPV = 1 / maturityDiscountFactor;
  const principalPVPercentResult = Percentage.fromDecimal(principalPV);
  if (!principalPVPercentResult.success) {
    return principalPVPercentResult;
  }

  // Total dirty price as percentage of par
  const finalResult = totalPV.add(principalPVPercentResult.value);
  return finalResult;
}
