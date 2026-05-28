import { Result, ResultHelper } from "@domain/shared";
import { Percentage, UTCDate } from "@domain/valueObjects";
import { DayCountConvention, CouponPayment } from "@domain/formulas";
import { dayCountFraction } from "@domain/formulas";
import { ImpliedRateFixedInput } from "./DiscountRate.types";

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-8;

// Below this time-to-maturity, annualized YTM blows up (a bond 8 days from
// maturity priced ~par computes as 150%+ YTM, which is mathematically valid but
// useless). Fall back to a non-annualized holding-period return.
const SHORT_MATURITY_YEARS = 30 / 365;

/**
 * Calculate implied discount rate from clean price for fixed rate bond
 *
 * Uses Newton-Raphson method to find the yield that makes PV = clean price
 *
 * Newton-Raphson formula:
 * y_new = y_old - f(y) / f'(y)
 *
 * Where:
 * - f(y) = calculated price at yield y - target price
 * - f'(y) = derivative of price with respect to yield
 */
export function calculateImpliedRateFixed(
  input: ImpliedRateFixedInput
): Result<Percentage> {
  const frequency = input.frequency;

  // Target price as percentage (already in the right format)
  const targetPrice = input.cleanPrice.asDecimal;

  // Short maturity guard: return holding-period return instead of annualized
  // YTM so duration validation downstream doesn't reject the result.
  const yearsToMaturity = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );
  if (yearsToMaturity > 0 && yearsToMaturity < SHORT_MATURITY_YEARS) {
    const couponPerPeriod = input.fixedRate.asDecimal / frequency;
    const totalCashFlow = 1.0 + couponPerPeriod * input.futureCoupons.length;
    if (targetPrice <= 0) {
      return ResultHelper.failure("Target price must be positive");
    }
    const holdingPeriodReturn = (totalCashFlow - targetPrice) / targetPrice;
    return Percentage.fromDecimal(holdingPeriodReturn);
  }

  // Initial guess: use coupon rate
  let yieldGuess = input.fixedRate.asDecimal;

  // Calculate coupon payment rate as % of par
  const couponPaymentRateResult = input.fixedRate.divide(frequency);
  if (!couponPaymentRateResult.success) {
    return couponPaymentRateResult;
  }
  const couponPaymentRate = couponPaymentRateResult.value.asDecimal;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const { price, derivative } = calculatePriceAndDerivative(
      couponPaymentRate,
      input.futureCoupons,
      input.settlementDate,
      input.maturityDate,
      yieldGuess,
      frequency,
      input.dayCountConvention
    );

    const priceDifference = price - targetPrice;

    // Check convergence
    if (Math.abs(priceDifference) < TOLERANCE) {
      return Percentage.fromDecimal(yieldGuess);
    }

    // Prevent division by zero
    if (Math.abs(derivative) < 1e-10) {
      return ResultHelper.failure(
        `Newton-Raphson failed: derivative too small at iteration ${iteration}`
      );
    }

    // Newton-Raphson update
    yieldGuess = yieldGuess - priceDifference / derivative;

    // Sanity check: yield should be reasonable
    if (yieldGuess < -0.5 || yieldGuess > 2.0) {
      return ResultHelper.failure(
        `Newton-Raphson diverged: yield out of bounds (${(
          yieldGuess * 100
        ).toFixed(2)}%)`
      );
    }
  }

  return ResultHelper.failure(
    `Newton-Raphson did not converge after ${MAX_ITERATIONS} iterations`
  );
}

/**
 * Calculate bond price (as % of par) and its derivative with respect to yield
 *
 * Price = sum of PV of all cash flows (as % of par)
 * Derivative = dPrice/dYield (needed for Newton-Raphson)
 */
function calculatePriceAndDerivative(
  couponPaymentRate: number, // Coupon payment as decimal % of par
  futureCoupons: CouponPayment[],
  settlementDate: UTCDate,
  maturityDate: UTCDate,
  yieldDecimal: number,
  compoundingFrequency: number,
  dayCountConvention: DayCountConvention
): { price: number; derivative: number } {
  let price = 0;
  let derivative = 0;

  const f = compoundingFrequency;

  // PV of coupon payments (as % of par)
  for (const coupon of futureCoupons) {
    const t = dayCountFraction(
      settlementDate,
      coupon.paymentDate,
      dayCountConvention
    );

    const exponent = f * t;
    const discountFactor = Math.pow(1 + yieldDecimal / f, exponent);

    // PV of this coupon (as % of par)
    const pv = couponPaymentRate / discountFactor;
    price += pv;

    // Derivative: d(PV)/dy = -PV * t / (1 + y/f)
    derivative -= (pv * t) / (1 + yieldDecimal / f);
  }

  // PV of principal at maturity (principal is 100% = 1.0 in decimal)
  const tMaturity = dayCountFraction(
    settlementDate,
    maturityDate,
    dayCountConvention
  );

  const maturityExponent = f * tMaturity;
  const maturityDiscountFactor = Math.pow(
    1 + yieldDecimal / f,
    maturityExponent
  );

  const principalPV = 1.0 / maturityDiscountFactor; // Principal is 100% of par
  price += principalPV;

  // Derivative of principal PV
  derivative -= (principalPV * tMaturity) / (1 + yieldDecimal / f);

  return { price, derivative };
}