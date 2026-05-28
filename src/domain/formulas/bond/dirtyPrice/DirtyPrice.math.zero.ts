import { Result } from "@domain/shared";
import { Percentage } from "@domain/valueObjects";
import { dayCountFraction } from "@domain/formulas";
import {
  DirtyPriceZeroFromYieldInput,
} from "./DirtyPrice.types";

/**
 * Calculate dirty price for zero coupon from discount rate
 * Formula: Price (as % of par) = 1 / (1 + r/f)^(f*t)
 */
export function calculateDirtyPriceZeroFromYield(
  input: DirtyPriceZeroFromYieldInput
): Result<Percentage> {
  const yearsToMaturity = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );

  // Per-period discount rate
  const periodicRateResult = input.discountRate.divide(input.compoundingFrequency);
  if (!periodicRateResult.success) {
    return periodicRateResult;
  }
  const periodicRate = periodicRateResult.value;

  // Number of compounding periods
  const numPeriods = input.compoundingFrequency * yearsToMaturity;

  // PV factor = 1 / (1 + r)^n
  const discountFactor = Math.pow(1 + periodicRate.asDecimal, numPeriods);
  const pvRatio = 1 / discountFactor;

  // Return as percentage of par
  return Percentage.fromDecimal(pvRatio);
}
