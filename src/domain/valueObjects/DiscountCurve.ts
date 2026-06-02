import { Percentage } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

/**
 * How a {@link DiscountCurve} fills the gaps between its observed pillars.
 *
 * The method is recorded on the curve so a discount factor is always
 * reproducible and auditable - the same inputs and method yield the same
 * number, and the choice is never implicit.
 *
 * @category Value Objects
 */
export enum CurveInterpolation {
  /**
   * Linear in `ln(DF)` between adjacent pillars, i.e. **piecewise-constant
   * forward rates**. The market-sane default: it never produces the kinked,
   * occasionally arbitrageable forwards that linear-on-yield can. See Hagan &
   * West (2006).
   */
  LOG_LINEAR_DF = "LOG_LINEAR_DF",
  /**
   * Linear on the zero (spot) rates themselves. Closest to the library's older
   * `interpolateYieldCurve` behaviour; offered for continuity.
   */
  LINEAR_ZERO = "LINEAR_ZERO",
}

/** A single observed point on the curve: a zero rate at a tenor (in years). */
interface ZeroPoint {
  tenor: number; // years; strictly > 0
  rate: number; // zero rate as a decimal (discrete annual compounding)
}

/**
 * An immutable term structure of discount factors built from observed zero
 * (spot) rates.
 *
 * Where a flat yield answers *"what is this one bond worth on its own?"*, a
 * `DiscountCurve` answers *"what is a cash flow at time `t` worth against the
 * market?"* - the primitive every curve-relative metric (curve pricing,
 * Z-spread, I/G-spread) is defined against. It is a value object in the mould
 * of {@link Money} / {@link Percentage}: validated on construction, never
 * mutated, and querying it can only fail through a {@link Result}.
 *
 * The curve exposes exactly one query, {@link discountFactor}, because that is
 * all the analytics in this library consume. Discounting uses **discrete
 * annual compounding** - `DF(t) = 1 / (1 + z(t))^t` - to stay bit-consistent
 * with the flat-yield pricing path, so a flat curve reproduces the flat-yield
 * price exactly.
 *
 * Between pillars the curve interpolates per its {@link CurveInterpolation}
 * method; beyond the first and last pillar it extrapolates the nearest zero
 * rate flat (an explicit, documented choice, not a silent one).
 *
 * @example
 * ```ts
 * const curve = DiscountCurve.fromZeroRates([
 *   { tenor: 1, rate: Percentage.fromDecimal(0.03).value },
 *   { tenor: 5, rate: Percentage.fromDecimal(0.035).value },
 * ]).value;
 * curve.discountFactor(2); // Result<number> ~ 0.9419
 * ```
 *
 * @category Value Objects
 */
export class DiscountCurve {
  /**
   * @param _points - Zero-rate pillars, pre-sorted strictly increasing by
   *   tenor. Held private; build via {@link fromZeroRates}.
   * @param _interpolation - The interpolation method, recorded for audit.
   */
  private constructor(
    private readonly _points: ReadonlyArray<ZeroPoint>,
    private readonly _interpolation: CurveInterpolation
  ) {}

  /**
   * Builds a {@link DiscountCurve} from observed zero (spot) rates.
   *
   * Validates that there is at least one pillar, that every tenor is finite
   * and strictly positive, that every rate is finite, and that the tenors are
   * distinct. The pillars are sorted by tenor before being stored, so callers
   * need not pre-sort.
   *
   * @param points - The zero-rate pillars: a tenor in years (`> 0`) and a
   *   {@link Percentage} zero rate for each.
   * @param options - Optional interpolation method; defaults to
   *   {@link CurveInterpolation.LOG_LINEAR_DF}.
   * @returns A successful {@link Result} with the curve, or a failure
   *   describing the first validation problem. Never throws.
   */
  static fromZeroRates(
    points: Array<{ tenor: number; rate: Percentage }>,
    options?: { interpolation?: CurveInterpolation }
  ): Result<DiscountCurve> {
    if (points.length === 0) {
      return ResultHelper.failure("Discount curve requires at least one point");
    }

    for (const p of points) {
      if (!Number.isFinite(p.tenor) || p.tenor <= 0) {
        return ResultHelper.failure(
          `Curve tenor must be finite and positive, got ${p.tenor}`
        );
      }
      if (!Number.isFinite(p.rate.asDecimal)) {
        return ResultHelper.failure("Curve rate must be a finite number");
      }
    }

    const sorted = [...points]
      .map((p) => ({ tenor: p.tenor, rate: p.rate.asDecimal }))
      .sort((a, b) => a.tenor - b.tenor);

    // Reject duplicate tenors: two rates at the same point are contradictory.
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].tenor === sorted[i - 1].tenor) {
        return ResultHelper.failure(
          `Curve tenors must be distinct, got two points at ${sorted[i].tenor}`
        );
      }
    }

    const interpolation =
      options?.interpolation ?? CurveInterpolation.LOG_LINEAR_DF;

    return ResultHelper.success(new DiscountCurve(sorted, interpolation));
  }

  /** The interpolation method this curve uses, recorded for audit. */
  get interpolation(): CurveInterpolation {
    return this._interpolation;
  }

  /**
   * The discount factor `DF(t)` - the present value today of 1 unit paid at
   * time `t` (in years).
   *
   * `DF(0)` is exactly `1`. Between pillars the value follows the curve's
   * {@link CurveInterpolation} method; outside the pillar range the nearest
   * zero rate is held flat. Uses discrete annual compounding:
   * `DF(t) = 1 / (1 + z(t))^t`.
   *
   * @param t - Time to the cash flow, in years; must be finite and `>= 0`.
   * @returns The discount factor, or a failure for a non-finite or negative
   *   `t`.
   */
  discountFactor(t: number): Result<number> {
    if (!Number.isFinite(t)) {
      return ResultHelper.failure(`Time ${t} must be a finite number`);
    }
    if (t < 0) {
      return ResultHelper.failure(`Time ${t} cannot be negative`);
    }
    if (t === 0) {
      return ResultHelper.success(1);
    }

    if (this._interpolation === CurveInterpolation.LOG_LINEAR_DF) {
      return ResultHelper.success(this.logLinearDF(t));
    }

    // LINEAR_ZERO: interpolate the zero rate, then discount discretely.
    const z = this.linearZeroRate(t);
    return ResultHelper.success(1 / Math.pow(1 + z, t));
  }

  /** Zero rate at `t` by flat-extrapolated linear interpolation on rates. */
  private linearZeroRate(t: number): number {
    const pts = this._points;

    // Flat extrapolation beyond either end.
    if (t <= pts[0].tenor) {
      return pts[0].rate;
    }
    if (t >= pts[pts.length - 1].tenor) {
      return pts[pts.length - 1].rate;
    }

    // Linear between the bracketing pillars.
    for (let i = 0; i < pts.length - 1; i++) {
      const lo = pts[i];
      const hi = pts[i + 1];
      if (t >= lo.tenor && t <= hi.tenor) {
        const w = (t - lo.tenor) / (hi.tenor - lo.tenor);
        return lo.rate + w * (hi.rate - lo.rate);
      }
    }

    // Unreachable given the guards above; satisfies the type checker.
    return pts[pts.length - 1].rate;
  }

  /** Node discount factor at a pillar, discrete annual compounding. */
  private nodeDF(p: ZeroPoint): number {
    return 1 / Math.pow(1 + p.rate, p.tenor);
  }

  /**
   * DF at `t` linear in `ln(DF)` between pillars (piecewise-constant forwards).
   *
   * Beyond the last pillar the final pillar's flat zero rate is used, which is
   * the same flat-forward extrapolation as the interior segments would give if
   * extended; before the first pillar the first pillar's flat zero rate holds.
   */
  private logLinearDF(t: number): number {
    const pts = this._points;

    if (t <= pts[0].tenor) {
      // Hold the first zero rate flat back to 0.
      return 1 / Math.pow(1 + pts[0].rate, t);
    }
    if (t >= pts[pts.length - 1].tenor) {
      // Hold the last zero rate flat onward.
      return 1 / Math.pow(1 + pts[pts.length - 1].rate, t);
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const lo = pts[i];
      const hi = pts[i + 1];
      if (t >= lo.tenor && t <= hi.tenor) {
        const lnLo = Math.log(this.nodeDF(lo));
        const lnHi = Math.log(this.nodeDF(hi));
        const w = (t - lo.tenor) / (hi.tenor - lo.tenor);
        return Math.exp(lnLo + w * (lnHi - lnLo));
      }
    }

    return this.nodeDF(pts[pts.length - 1]);
  }
}
