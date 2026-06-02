/**
 * Bootstrap math, tested directly on the domain function.
 *
 * The headline check is the strongest possible self-consistency test: pricing
 * each input par bond off the bootstrapped curve must recover par (1.0) to
 * ~1e-12. The other identities are analytic too: a ZERO_RATE pillar reproduces
 * its own closed-form discount factor, a pure-zero-rate bootstrap matches a
 * curve built directly from those rates, and the resulting discount factors
 * decrease monotonically in tenor.
 */
import { describe, it, expect } from "vitest";
import {
  bootstrapCurve,
  validateBootstrap,
  type BootstrapInstrument,
} from "@domain/formulas";
import { Percentage, DiscountCurve } from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";

function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}

/**
 * Price an annual-coupon par bond off `curve`: coupons of `couponRate` at each
 * integer year 1..tenor plus 100% principal at maturity. Returns price as a
 * fraction of par (so par = 1.0).
 */
function priceAnnualBond(
  curve: DiscountCurve,
  tenor: number,
  couponRate: number
): number {
  let pv = 0;
  for (let t = 1; t <= tenor; t++) {
    const df = unwrap(curve.discountFactor(t));
    pv += couponRate * df;
  }
  pv += 1.0 * unwrap(curve.discountFactor(tenor));
  return pv;
}

/** An upward-sloping set of annual par bonds at 1y..5y. */
function parBonds(): BootstrapInstrument[] {
  return [
    { kind: "PAR_BOND", tenor: 1, couponRate: pct(0.02), frequency: 1 },
    { kind: "PAR_BOND", tenor: 2, couponRate: pct(0.025), frequency: 1 },
    { kind: "PAR_BOND", tenor: 3, couponRate: pct(0.03), frequency: 1 },
    { kind: "PAR_BOND", tenor: 4, couponRate: pct(0.0325), frequency: 1 },
    { kind: "PAR_BOND", tenor: 5, couponRate: pct(0.035), frequency: 1 },
  ];
}

describe("bootstrapCurve — round-trip to par", () => {
  it("reprices every input par bond to exactly 100", () => {
    const instruments = parBonds();
    const curve = unwrap(bootstrapCurve({ instruments }));

    for (const inst of instruments) {
      if (inst.kind !== "PAR_BOND") continue;
      const price = priceAnnualBond(
        curve,
        inst.tenor,
        inst.couponRate.asDecimal
      );
      expect(price).toBeCloseTo(1.0, 12);
    }
  });

  it("round-trips a mixed zero-rate + par-bond curve to par", () => {
    // Front pinned by a 1y deposit (zero rate); 2y–4y are par bonds whose
    // earlier coupons fall on the already-solved 1y..(n-1)y pillars.
    const instruments: BootstrapInstrument[] = [
      { kind: "ZERO_RATE", tenor: 1, rate: pct(0.02) },
      { kind: "PAR_BOND", tenor: 2, couponRate: pct(0.025), frequency: 1 },
      { kind: "PAR_BOND", tenor: 3, couponRate: pct(0.03), frequency: 1 },
      { kind: "PAR_BOND", tenor: 4, couponRate: pct(0.0325), frequency: 1 },
    ];
    const curve = unwrap(bootstrapCurve({ instruments }));

    for (const inst of instruments) {
      if (inst.kind !== "PAR_BOND") continue;
      const price = priceAnnualBond(
        curve,
        inst.tenor,
        inst.couponRate.asDecimal
      );
      expect(price).toBeCloseTo(1.0, 12);
    }
  });
});

describe("bootstrapCurve — identities", () => {
  it("a ZERO_RATE pillar reproduces its closed-form discount factor", () => {
    const curve = unwrap(
      bootstrapCurve({
        instruments: [
          { kind: "ZERO_RATE", tenor: 1, rate: pct(0.02) },
          { kind: "ZERO_RATE", tenor: 5, rate: pct(0.035) },
        ],
      })
    );
    expect(unwrap(curve.discountFactor(1))).toBeCloseTo(1 / 1.02, 12);
    expect(unwrap(curve.discountFactor(5))).toBeCloseTo(
      1 / Math.pow(1.035, 5),
      12
    );
  });

  it("a pure zero-rate bootstrap matches a curve built directly from the rates", () => {
    const bootstrapped = unwrap(
      bootstrapCurve({
        instruments: [
          { kind: "ZERO_RATE", tenor: 1, rate: pct(0.02) },
          { kind: "ZERO_RATE", tenor: 3, rate: pct(0.03) },
          { kind: "ZERO_RATE", tenor: 5, rate: pct(0.035) },
        ],
      })
    );
    const direct = unwrap(
      DiscountCurve.fromZeroRates([
        { tenor: 1, rate: pct(0.02) },
        { tenor: 3, rate: pct(0.03) },
        { tenor: 5, rate: pct(0.035) },
      ])
    );
    for (const t of [0.5, 1, 2, 3, 4, 5, 7]) {
      expect(unwrap(bootstrapped.discountFactor(t))).toBeCloseTo(
        unwrap(direct.discountFactor(t)),
        12
      );
    }
  });

  it("produces monotonically decreasing discount factors (positive rates)", () => {
    const curve = unwrap(bootstrapCurve({ instruments: parBonds() }));
    let prev = unwrap(curve.discountFactor(0));
    for (const t of [1, 2, 3, 4, 5]) {
      const df = unwrap(curve.discountFactor(t));
      expect(df).toBeLessThan(prev);
      prev = df;
    }
  });

  it("accepts unsorted instruments and sorts internally", () => {
    const curve = unwrap(
      bootstrapCurve({
        instruments: [
          { kind: "PAR_BOND", tenor: 3, couponRate: pct(0.03), frequency: 1 },
          { kind: "PAR_BOND", tenor: 1, couponRate: pct(0.02), frequency: 1 },
          { kind: "PAR_BOND", tenor: 2, couponRate: pct(0.025), frequency: 1 },
        ],
      })
    );
    expect(priceAnnualBond(curve, 1, 0.02)).toBeCloseTo(1.0, 12);
    expect(priceAnnualBond(curve, 3, 0.03)).toBeCloseTo(1.0, 12);
  });
});

describe("bootstrapCurve — semi-annual par bonds", () => {
  it("reprices a semi-annual par bond to par", () => {
    // Pin every half-year pillar 0.5..2.0 so the 2y bond's coupons all land on
    // solved tenors, then bootstrap a 2y semi-annual par bond on top.
    const instruments: BootstrapInstrument[] = [
      { kind: "ZERO_RATE", tenor: 0.5, rate: pct(0.02) },
      { kind: "ZERO_RATE", tenor: 1.0, rate: pct(0.022) },
      { kind: "ZERO_RATE", tenor: 1.5, rate: pct(0.024) },
      { kind: "PAR_BOND", tenor: 2.0, couponRate: pct(0.03), frequency: 2 },
    ];
    const curve = unwrap(bootstrapCurve({ instruments }));

    // Price the 2y semi-annual bond: 3%/2 at 0.5,1.0,1.5,2.0 + par at 2.0.
    let pv = 0;
    for (const t of [0.5, 1.0, 1.5, 2.0]) {
      pv += (0.03 / 2) * unwrap(curve.discountFactor(t));
    }
    pv += unwrap(curve.discountFactor(2.0));
    expect(pv).toBeCloseTo(1.0, 12);
  });
});

describe("bootstrapCurve — validation & failure", () => {
  it("rejects an empty instrument set", () => {
    expect(validateBootstrap({ instruments: [] }).success).toBe(false);
    expect(bootstrapCurve({ instruments: [] }).success).toBe(false);
  });

  it("rejects non-positive tenors", () => {
    const r = validateBootstrap({
      instruments: [
        { kind: "ZERO_RATE", tenor: 0, rate: pct(0.02) },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejects duplicate tenors", () => {
    const r = validateBootstrap({
      instruments: [
        { kind: "ZERO_RATE", tenor: 2, rate: pct(0.02) },
        { kind: "PAR_BOND", tenor: 2, couponRate: pct(0.03), frequency: 1 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-integer par-bond frequency", () => {
    const r = validateBootstrap({
      instruments: [
        { kind: "PAR_BOND", tenor: 2, couponRate: pct(0.03), frequency: 1.5 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("fails when a par bond's coupon falls beyond the solved range", () => {
    // A lone 5y annual par bond: its 1y..4y coupons have no shorter pillar to
    // discount against, so the bootstrap cannot proceed.
    const r = bootstrapCurve({
      instruments: [
        { kind: "PAR_BOND", tenor: 5, couponRate: pct(0.03), frequency: 1 },
      ],
    });
    expect(r.success).toBe(false);
  });
});
