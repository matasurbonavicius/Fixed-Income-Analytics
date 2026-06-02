import { Result, ResultHelper } from "@domain/shared";
import { DiscountCurve } from "@domain/valueObjects";
import {
  BootstrapInput,
  BootstrapInstrument,
  BootstrappedPillar,
  ParBondPillar,
} from "./Bootstrap.types";

/** Discount factor for a zero rate `z` at tenor `t`, discrete annual. */
function zeroRateToDF(rate: number, tenor: number): number {
  return 1 / Math.pow(1 + rate, tenor);
}

/**
 * Solve the discount factor at a par bond's maturity, given a curve already
 * built from all shorter pillars.
 *
 * A bond quoted at par satisfies `1 = c·Σ_i DF(t_i) + (1+c)·DF(T)`, where `c` is
 * the coupon per period and `t_n = T` is maturity. Every coupon time before
 * maturity must fall within the already-solved range so its discount factor can
 * be read off `partial`; the maturity discount factor is then the only unknown
 * and falls out linearly:
 *
 *   DF(T) = (1 - c·Σ_{i<n} DF(t_i)) / (1 + c)
 */
function solveParBondDF(
  bond: ParBondPillar,
  partial: DiscountCurve | null,
  lastSolvedTenor: number
): Result<number> {
  const couponPerPeriod = bond.couponRate.asDecimal / bond.frequency;
  const periodYears = 1 / bond.frequency;

  // Coupon times back from maturity: T, T - 1/f, ... down to the first that is
  // still > 0. The maturity flow (i = 0) is the unknown; the rest must be known.
  let sumKnownCouponDF = 0;
  // Number of whole periods from settlement to maturity (rounded to the grid).
  const periods = Math.round(bond.tenor * bond.frequency);
  if (periods < 1) {
    return ResultHelper.failure(
      `Par bond at ${bond.tenor}y has no coupon periods at frequency ${bond.frequency}`
    );
  }

  for (let i = 1; i < periods; i++) {
    const t = bond.tenor - i * periodYears;
    if (t <= 0) {
      break;
    }
    // Every intermediate coupon must lie within the already-solved range, else
    // its discount factor would be an extrapolation we cannot trust.
    if (partial === null || t > lastSolvedTenor + 1e-9) {
      return ResultHelper.failure(
        `Par bond at ${bond.tenor}y has a coupon at ${t.toFixed(
          4
        )}y beyond the solved range (${lastSolvedTenor}y); add a shorter pillar`
      );
    }
    const dfResult = partial.discountFactor(t);
    if (!dfResult.success) {
      return dfResult;
    }
    sumKnownCouponDF += dfResult.value;
  }

  const dfMaturity =
    (1 - couponPerPeriod * sumKnownCouponDF) / (1 + couponPerPeriod);

  if (!(dfMaturity > 0) || !Number.isFinite(dfMaturity)) {
    return ResultHelper.failure(
      `Par bond at ${bond.tenor}y implied a non-positive discount factor (${dfMaturity}); check the quote`
    );
  }

  return ResultHelper.success(dfMaturity);
}

/**
 * Bootstrap a {@link DiscountCurve} from observed par instruments and zero-rate
 * pillars.
 *
 * Instruments are processed in increasing tenor order. A `ZERO_RATE` pillar
 * contributes its discount factor directly; a `PAR_BOND` is solved against the
 * curve built from all shorter pillars so that it reprices to par. The result
 * is assembled from the solved discount factors via
 * {@link DiscountCurve.fromDiscountFactors}, so the returned curve interpolates
 * and extrapolates exactly like any other.
 *
 * The strongest self-consistency check is that pricing each input par bond off
 * the returned curve recovers par - see the bootstrap tests.
 *
 * @internal
 */
export function bootstrapCurve(input: BootstrapInput): Result<DiscountCurve> {
  const sorted = [...input.instruments].sort((a, b) => a.tenor - b.tenor);

  const pillars: BootstrappedPillar[] = [];
  let partial: DiscountCurve | null = null;
  let lastSolvedTenor = 0;

  for (const inst of sorted) {
    const dfResult = solveInstrumentDF(inst, partial, lastSolvedTenor);
    if (!dfResult.success) {
      return dfResult;
    }

    pillars.push({ tenor: inst.tenor, df: dfResult.value });
    lastSolvedTenor = inst.tenor;

    // Rebuild the partial curve so the next instrument's earlier coupons can be
    // interpolated against everything solved so far.
    const partialResult = DiscountCurve.fromDiscountFactors(pillars, {
      interpolation: input.interpolation,
    });
    if (!partialResult.success) {
      return partialResult;
    }
    partial = partialResult.value;
  }

  return DiscountCurve.fromDiscountFactors(pillars, {
    interpolation: input.interpolation,
  });
}

/** Solve the discount factor for a single instrument. */
function solveInstrumentDF(
  inst: BootstrapInstrument,
  partial: DiscountCurve | null,
  lastSolvedTenor: number
): Result<number> {
  if (inst.kind === "ZERO_RATE") {
    return ResultHelper.success(zeroRateToDF(inst.rate.asDecimal, inst.tenor));
  }
  return solveParBondDF(inst, partial, lastSolvedTenor);
}
