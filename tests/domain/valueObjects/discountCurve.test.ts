/**
 * DiscountCurve identities, tested directly on the value object.
 *
 * These hold *analytically*, not just to a loose tolerance: DF(0) = 1, a flat
 * curve reproduces the closed-form discrete discount factor, the two
 * interpolation methods agree at the pillars, and beyond the pillars the curve
 * extrapolates flat.
 */
import { describe, it, expect } from "vitest";
import { Percentage } from "@domain/valueObjects";
import { DiscountCurve, CurveInterpolation } from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";

function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}

/** Pillars: 3% @ 1y, 3.5% @ 5y, 4% @ 10y. */
function sampleCurve(interpolation?: CurveInterpolation): DiscountCurve {
  return unwrap(
    DiscountCurve.fromZeroRates(
      [
        { tenor: 1, rate: pct(0.03) },
        { tenor: 5, rate: pct(0.035) },
        { tenor: 10, rate: pct(0.04) },
      ],
      interpolation ? { interpolation } : undefined
    )
  );
}

describe("DiscountCurve — construction", () => {
  it("rejects an empty point set", () => {
    const r = DiscountCurve.fromZeroRates([]);
    expect(r.success).toBe(false);
  });

  it("rejects non-positive tenors", () => {
    const r = DiscountCurve.fromZeroRates([{ tenor: 0, rate: pct(0.03) }]);
    expect(r.success).toBe(false);
  });

  it("rejects duplicate tenors", () => {
    const r = DiscountCurve.fromZeroRates([
      { tenor: 2, rate: pct(0.03) },
      { tenor: 2, rate: pct(0.04) },
    ]);
    expect(r.success).toBe(false);
  });

  it("accepts unsorted input and sorts internally", () => {
    const curve = unwrap(
      DiscountCurve.fromZeroRates([
        { tenor: 5, rate: pct(0.035) },
        { tenor: 1, rate: pct(0.03) },
      ])
    );
    // At the 1y pillar DF = 1/1.03.
    expect(unwrap(curve.discountFactor(1))).toBeCloseTo(1 / 1.03, 12);
  });

  it("defaults to LOG_LINEAR_DF interpolation", () => {
    expect(sampleCurve().interpolation).toBe(CurveInterpolation.LOG_LINEAR_DF);
  });
});

describe("DiscountCurve — identities", () => {
  it("DF(0) = 1 exactly", () => {
    expect(unwrap(sampleCurve().discountFactor(0))).toBe(1);
  });

  it("rejects negative time", () => {
    expect(sampleCurve().discountFactor(-1).success).toBe(false);
  });

  it("a flat curve reproduces the closed-form DF = (1+r)^-t", () => {
    const flat = unwrap(
      DiscountCurve.fromZeroRates([
        { tenor: 1, rate: pct(0.04) },
        { tenor: 10, rate: pct(0.04) },
      ])
    );
    for (const t of [0.5, 1, 2.5, 7, 12]) {
      expect(unwrap(flat.discountFactor(t))).toBeCloseTo(
        1 / Math.pow(1.04, t),
        12
      );
    }
  });

  it("reproduces the pillar DF at each node (both methods)", () => {
    for (const method of [
      CurveInterpolation.LOG_LINEAR_DF,
      CurveInterpolation.LINEAR_ZERO,
    ]) {
      const curve = sampleCurve(method);
      expect(unwrap(curve.discountFactor(1))).toBeCloseTo(1 / Math.pow(1.03, 1), 12);
      expect(unwrap(curve.discountFactor(5))).toBeCloseTo(1 / Math.pow(1.035, 5), 12);
      expect(unwrap(curve.discountFactor(10))).toBeCloseTo(1 / Math.pow(1.04, 10), 12);
    }
  });

  it("is monotonically decreasing in t (positive rates)", () => {
    const curve = sampleCurve();
    let prev = unwrap(curve.discountFactor(0));
    for (const t of [0.25, 1, 3, 5, 8, 10, 15]) {
      const df = unwrap(curve.discountFactor(t));
      expect(df).toBeLessThan(prev);
      prev = df;
    }
  });

  it("extrapolates flat in zero-rate beyond the last pillar", () => {
    const curve = sampleCurve();
    // Past 10y the 4% rate is held flat: DF(12) = 1/1.04^12.
    expect(unwrap(curve.discountFactor(12))).toBeCloseTo(1 / Math.pow(1.04, 12), 12);
  });

  it("LOG_LINEAR_DF has constant forward rates within a segment", () => {
    const curve = sampleCurve(CurveInterpolation.LOG_LINEAR_DF);
    // Forward between adjacent sub-intervals of the 1y–5y segment must match.
    const f = (a: number, b: number) => {
      const dfa = unwrap(curve.discountFactor(a));
      const dfb = unwrap(curve.discountFactor(b));
      // Discrete annual forward over [a,b]: (DFa/DFb)^(1/(b-a)) - 1.
      return Math.pow(dfa / dfb, 1 / (b - a)) - 1;
    };
    expect(f(2, 3)).toBeCloseTo(f(3, 4), 10);
  });
});
