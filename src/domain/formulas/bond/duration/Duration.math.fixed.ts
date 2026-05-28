import { Result, ResultHelper } from "@domain/shared";
import { dayCountFraction } from "@domain/formulas";
import {
  MacaulayDurationFixedInput,
  DurationResult,
} from "./Duration.types";

/**
 * Calculate all duration metrics for a fixed-rate bond
 *
 * Macaulay Duration formula:
 * D_mac = Σ(t_i × PV_i) / Σ(PV_i)
 *
 * Where:
 * - t_i = time to cash flow i (in years)
 * - PV_i = present value of cash flow i (as % of par)
 *
 * Modified Duration:
 * D_mod = D_mac / (1 + yield/frequency)
 *
 * Dollar Duration:
 * Dollar_D = D_mod × Market Value
 * where Market Value = Face Value × Clean Price (as %)
 *
 * @param input - Fixed rate bond parameters
 * @returns Result containing all three duration metrics
 */
export function calculateDurationFixed(
  input: MacaulayDurationFixedInput
): Result<DurationResult> {
  const compoundingFrequency = input.compoundingFrequency ?? input.frequency;

  // Per-period discount rate
  const periodicRateResult = input.yield.divide(compoundingFrequency);
  if (!periodicRateResult.success) {
    return periodicRateResult;
  }
  const periodicRate = periodicRateResult.value;

  // Calculate coupon payment rate as % of par
  const couponPaymentRateResult = input.fixedRate.divide(input.frequency);
  if (!couponPaymentRateResult.success) {
    return couponPaymentRateResult;
  }
  const couponPaymentRate = couponPaymentRateResult.value;

  let weightedTime = 0;
  let totalPV = 0;

  // Calculate PV and weighted time for each coupon payment (as % of par)
  for (const coupon of input.futureCoupons) {
    const timeToPayment = dayCountFraction(
      input.settlementDate,
      coupon.paymentDate,
      input.dayCountConvention
    );

    const numPeriods = compoundingFrequency * timeToPayment;
    
    // PV factor = 1 / (1 + r)^n
    const discountFactor = Math.pow(1 + periodicRate.asDecimal, numPeriods);
    const pvFactor = 1 / discountFactor;
    
    // PV of this coupon (as % of par)
    const pv = couponPaymentRate.asDecimal * pvFactor;
    
    weightedTime += timeToPayment * pv;
    totalPV += pv;
  }

  // Add principal repayment at maturity (100% of par)
  const timeToMaturity = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );

  const maturityPeriods = compoundingFrequency * timeToMaturity;
  const maturityDiscountFactor = Math.pow(1 + periodicRate.asDecimal, maturityPeriods);
  const principalPV = 1 / maturityDiscountFactor; // Principal is 100% = 1.0
  
  weightedTime += timeToMaturity * principalPV;
  totalPV += principalPV;

  // Macaulay Duration = Weighted Average Time
  if (totalPV === 0) {
    return ResultHelper.failure("Total present value is zero");
  }

  const macaulayDuration = weightedTime / totalPV;

  // Modified Duration = Macaulay Duration / (1 + yield/frequency)
  const modifiedDuration =
    macaulayDuration / (1 + input.yield.asDecimal / compoundingFrequency);

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