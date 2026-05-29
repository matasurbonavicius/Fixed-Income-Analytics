import { Result, ResultHelper } from "@domain/shared";
import { Percentage } from "@domain/valueObjects";
import { dayCountFraction } from "@domain/formulas";
import { ImpliedRateZeroInput } from "./DiscountRate.types";

/**
 * Calculate implied discount rate from clean price for zero coupon bond
 *
 * Uses analytical formula (no iteration needed):
 * Price = 100 / (1 + r/f)^(f*t)
 *
 * Solving for r:
 * r = f * ((100/Price)^(1/(f*t)) - 1)
 *
 * Where:
 * - Price = clean price as % of par (e.g., 95.23 means 95.23% of face value)
 * - r = discount rate (annual)
 * - f = compounding frequency
 * - t = time to maturity in years
 */
// Below this time-to-maturity, annualized YTM blows up (a bond near maturity
// produces nonsensical 100%+ rates). Fall back to non-annualized holding-period
// return so downstream consumers (duration, validators) get a sane value.
const SHORT_MATURITY_YEARS = 30 / 365;

/** @internal */
export function calculateImpliedRateZero(
  input: ImpliedRateZeroInput
): Result<Percentage> {
  const yearsToMaturity = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );

  if (yearsToMaturity <= 0) {
    return ResultHelper.failure("Years to maturity must be positive");
  }

  if (input.cleanPrice.asDecimal <= 0) {
    return ResultHelper.failure("Clean price must be positive");
  }

  // Short maturity guard: holding-period return (zero coupons have only the
  // principal as the remaining cash flow).
  if (yearsToMaturity < SHORT_MATURITY_YEARS) {
    const holdingPeriodReturn = (1.0 - input.cleanPrice.asDecimal) / input.cleanPrice.asDecimal;
    return Percentage.fromDecimal(holdingPeriodReturn);
  }

  const f = 1; // For zero bonds use annual compounding

  // r = f * ((100/Price)^(1/(f*t)) - 1)
  // cleanPrice is already a percentage (e.g., 0.9523 for 95.23%)
  // We want the ratio 100%/Price% = 1.0/cleanPrice.asDecimal
  const priceRatio = 1.0 / input.cleanPrice.asDecimal;

  const exponent = 1 / (f * yearsToMaturity);
  const rateFactor = Math.pow(priceRatio, exponent);
  const impliedRate = f * (rateFactor - 1);

  return Percentage.fromDecimal(impliedRate);
}