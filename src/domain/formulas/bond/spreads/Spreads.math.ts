import { Result, ResultHelper } from "@domain/shared";
import { Percentage, DiscountCurve } from "@domain/valueObjects";
import { dayCountFraction } from "@domain/formulas";
import {
  ZSpreadFixedInput,
  ZSpreadZeroInput,
  SimpleSpreadInput,
} from "./Spreads.types";

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-10;

/**
 * One bond cash flow reduced to what the solver needs: its time in years and
 * the base zero rate the curve implies at that time. Pre-computing the base
 * rate once per flow keeps the Newton iteration cheap and lets us bump every
 * flow by the same spread `z` analytically.
 */
interface FlowPoint {
  t: number; // time to flow, in years
  cf: number; // cash flow as % of par (decimal)
  baseRate: number; // curve zero rate at t (discrete annual), as decimal
}

/** Zero rate the curve implies at time `t`: z = DF(t)^(-1/t) - 1. */
function curveZeroRate(curve: DiscountCurve, t: number): Result<number> {
  const dfResult = curve.discountFactor(t);
  if (!dfResult.success) {
    return dfResult;
  }
  const df = dfResult.value;
  if (df <= 0) {
    return ResultHelper.failure(`Non-positive discount factor at t=${t}`);
  }
  return ResultHelper.success(Math.pow(df, -1 / t) - 1);
}

/**
 * Price the flows at a given spread `z` and return the price (as % of par) and
 * its derivative w.r.t. `z`, both needed for Newton-Raphson.
 *
 * Each flow is discounted at `(1 + baseRate + z)^(-t)`; the derivative of that
 * factor w.r.t. `z` is `-t / (1 + baseRate + z)` times the factor.
 */
function priceAndDerivative(
  flows: FlowPoint[],
  z: number
): { price: number; derivative: number } {
  let price = 0;
  let derivative = 0;

  for (const f of flows) {
    const base = 1 + f.baseRate + z;
    const df = Math.pow(base, -f.t);
    const pv = f.cf * df;
    price += pv;
    derivative += pv * (-f.t / base);
  }

  return { price, derivative };
}

/** Solve for the spread `z` that prices `flows` to `targetPrice`. */
function solveZSpread(
  flows: FlowPoint[],
  targetPrice: number
): Result<Percentage> {
  let z = 0; // start at the curve itself

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const { price, derivative } = priceAndDerivative(flows, z);
    const diff = price - targetPrice;

    if (Math.abs(diff) < TOLERANCE) {
      return Percentage.fromDecimal(z);
    }

    if (Math.abs(derivative) < 1e-12) {
      return ResultHelper.failure(
        `Z-spread solver failed: derivative too small at iteration ${i}`
      );
    }

    z = z - diff / derivative;

    // The curve PV is monotonic in z, so a sane root sits in a wide band.
    if (z < -0.5 || z > 2.0) {
      return ResultHelper.failure(
        `Z-spread solver diverged: spread out of bounds (${(z * 100).toFixed(2)}%)`
      );
    }
  }

  return ResultHelper.failure(
    `Z-spread solver did not converge after ${MAX_ITERATIONS} iterations`
  );
}

/**
 * Solve the Z-spread of a fixed-rate bond: the constant add-on to every zero
 * rate of the curve that discounts the bond's coupons and principal back to
 * its observed dirty price.
 *
 * @internal
 */
export function calculateZSpreadFixed(
  input: ZSpreadFixedInput
): Result<Percentage> {
  const couponRateResult = input.fixedRate.divide(input.frequency);
  if (!couponRateResult.success) {
    return couponRateResult;
  }
  const couponRate = couponRateResult.value.asDecimal;

  const flows: FlowPoint[] = [];

  for (const coupon of input.futureCoupons) {
    const t = dayCountFraction(
      input.settlementDate,
      coupon.paymentDate,
      input.dayCountConvention
    );
    const baseResult = curveZeroRate(input.curve, t);
    if (!baseResult.success) {
      return baseResult;
    }
    flows.push({ t, cf: couponRate, baseRate: baseResult.value });
  }

  // Principal (100% of par) at maturity. Fold it onto the maturity coupon flow
  // if one already lands there, otherwise add a dedicated flow.
  const tMaturity = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );
  const maturityBaseResult = curveZeroRate(input.curve, tMaturity);
  if (!maturityBaseResult.success) {
    return maturityBaseResult;
  }
  const existing = flows.find((f) => Math.abs(f.t - tMaturity) < 1e-9);
  if (existing) {
    existing.cf += 1.0;
  } else {
    flows.push({ t: tMaturity, cf: 1.0, baseRate: maturityBaseResult.value });
  }

  return solveZSpread(flows, input.dirtyPrice.asDecimal);
}

/**
 * Solve the Z-spread of a zero-coupon bond - a single principal flow at
 * maturity discounted at the curve rate plus the spread.
 *
 * @internal
 */
export function calculateZSpreadZero(
  input: ZSpreadZeroInput
): Result<Percentage> {
  const t = dayCountFraction(
    input.settlementDate,
    input.maturityDate,
    input.dayCountConvention
  );
  const baseResult = curveZeroRate(input.curve, t);
  if (!baseResult.success) {
    return baseResult;
  }

  const flows: FlowPoint[] = [{ t, cf: 1.0, baseRate: baseResult.value }];
  return solveZSpread(flows, input.dirtyPrice.asDecimal);
}

/**
 * Compute the simple curve-relative spreads: I-spread (bond yield minus the
 * swap/benchmark curve's zero rate at the bond's remaining life) and, when a
 * government curve is supplied, G-spread (the same against that curve).
 *
 * @internal
 */
export function calculateSimpleSpreads(input: SimpleSpreadInput): Result<{
  iSpread: Percentage;
  gSpread?: Percentage;
}> {
  const t = input.yearsToMaturity;
  if (!(t > 0)) {
    return ResultHelper.failure("Years to maturity must be positive");
  }

  const swapRateResult = curveZeroRate(input.curve, t);
  if (!swapRateResult.success) {
    return swapRateResult;
  }
  const swapRatePct = Percentage.fromDecimal(swapRateResult.value);
  if (!swapRatePct.success) {
    return swapRatePct;
  }
  const iSpreadResult = input.bondYield.subtract(swapRatePct.value);
  if (!iSpreadResult.success) {
    return iSpreadResult;
  }

  if (!input.govvieCurve) {
    return ResultHelper.success({ iSpread: iSpreadResult.value });
  }

  const govRateResult = curveZeroRate(input.govvieCurve, t);
  if (!govRateResult.success) {
    return govRateResult;
  }
  const govRatePct = Percentage.fromDecimal(govRateResult.value);
  if (!govRatePct.success) {
    return govRatePct;
  }
  const gSpreadResult = input.bondYield.subtract(govRatePct.value);
  if (!gSpreadResult.success) {
    return gSpreadResult;
  }

  return ResultHelper.success({
    iSpread: iSpreadResult.value,
    gSpread: gSpreadResult.value,
  });
}
