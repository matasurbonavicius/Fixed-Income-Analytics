/**
 * Z-spread math, tested directly on the domain functions.
 *
 * The pinned identities are analytic: a bond priced exactly *on* the curve has
 * a Z-spread of ~0; a richer (higher) price gives a smaller/negative spread and
 * a cheaper (lower) price a larger one (monotonic); and a flat-curve Z-spread
 * recovers the gap between the bond's flat yield and the curve rate.
 */
import { describe, it, expect } from "vitest";
import {
  calculateZSpreadFixed,
  calculateZSpreadZero,
  calculateSimpleSpreads,
  calculateDirtyPriceFixedFromCurve,
  calculateDirtyPriceZeroFromCurve,
  type CouponPayment,
} from "@domain/formulas";
import { Percentage, UTCDate, DiscountCurve } from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";

function d(iso: string): UTCDate {
  return unwrap(UTCDate.fromString(iso));
}
function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}
const DCC = "ACT_ACT" as const;

function annualCoupons(years: string[]): CouponPayment[] {
  return years.map((y, i) => ({
    paymentDate: d(`${y}-01-01`),
    periodStartDate: d(`${years[i - 1] ?? "2025"}-01-01`),
    periodEndDate: d(`${y}-01-01`),
    isRegular: true,
  }));
}

/** Upward-sloping sample curve, 2.5%–3.5%. */
function sampleCurve(): DiscountCurve {
  return unwrap(
    DiscountCurve.fromZeroRates([
      { tenor: 1, rate: pct(0.025) },
      { tenor: 3, rate: pct(0.03) },
      { tenor: 5, rate: pct(0.035) },
    ])
  );
}

describe("Z-spread — fixed", () => {
  const coupons = annualCoupons(["2027", "2028", "2029", "2030", "2031"]);
  const base = {
    fixedRate: pct(0.035),
    frequency: 1,
    settlementDate: d("2026-01-01"),
    maturityDate: d("2031-01-01"),
    futureCoupons: coupons,
    curve: sampleCurve(),
    dayCountConvention: DCC,
  };

  it("is ~0 when the bond is priced exactly on the curve", () => {
    // Price the bond off the curve, then solve its Z-spread against the same
    // curve: the spread that reproduces a curve price is zero.
    const onCurvePrice = unwrap(
      calculateDirtyPriceFixedFromCurve({
        fixedRate: base.fixedRate,
        frequency: base.frequency,
        settlementDate: base.settlementDate,
        maturityDate: base.maturityDate,
        futureCoupons: base.futureCoupons,
        curve: base.curve,
        dayCountConvention: base.dayCountConvention,
      })
    );
    const z = unwrap(
      calculateZSpreadFixed({ ...base, dirtyPrice: onCurvePrice })
    );
    expect(z.asDecimal).toBeCloseTo(0, 10);
  });

  it("is negative for a richer (higher) price and positive for a cheaper one", () => {
    const onCurvePrice = unwrap(
      calculateDirtyPriceFixedFromCurve({
        fixedRate: base.fixedRate,
        frequency: base.frequency,
        settlementDate: base.settlementDate,
        maturityDate: base.maturityDate,
        futureCoupons: base.futureCoupons,
        curve: base.curve,
        dayCountConvention: base.dayCountConvention,
      })
    );
    const richer = pct(onCurvePrice.asDecimal + 0.02); // pay more
    const cheaper = pct(onCurvePrice.asDecimal - 0.02); // pay less

    const zRicher = unwrap(calculateZSpreadFixed({ ...base, dirtyPrice: richer }));
    const zCheaper = unwrap(calculateZSpreadFixed({ ...base, dirtyPrice: cheaper }));

    expect(zRicher.asDecimal).toBeLessThan(0);
    expect(zCheaper.asDecimal).toBeGreaterThan(0);
    expect(zCheaper.asDecimal).toBeGreaterThan(zRicher.asDecimal);
  });
});

describe("Z-spread — zero", () => {
  const base = {
    settlementDate: d("2026-01-01"),
    maturityDate: d("2029-01-01"),
    curve: sampleCurve(),
    dayCountConvention: DCC,
  };

  it("is ~0 when priced on the curve", () => {
    const onCurve = unwrap(calculateDirtyPriceZeroFromCurve(base));
    const z = unwrap(calculateZSpreadZero({ ...base, dirtyPrice: onCurve }));
    expect(z.asDecimal).toBeCloseTo(0, 10);
  });

  it("recovers a known parallel shift on a flat curve", () => {
    // On a flat 3% curve, a zero whose price implies a 4% yield must have a
    // Z-spread of ~100bp.
    const flat = unwrap(
      DiscountCurve.fromZeroRates([
        { tenor: 1, rate: pct(0.03) },
        { tenor: 10, rate: pct(0.03) },
      ])
    );
    // Price the 3y zero at 4%: DF = 1/1.04^3.
    const price = pct(1 / Math.pow(1.04, 3));
    const z = unwrap(
      calculateZSpreadZero({ ...base, curve: flat, dirtyPrice: price })
    );
    expect(z.asDecimal).toBeCloseTo(0.01, 8);
  });
});

describe("simple spreads — I/G", () => {
  it("I-spread = bond yield minus the curve rate at the bond's life", () => {
    const curve = sampleCurve();
    // Curve rate at 3y is the 3% pillar; a 3.8% bond yield → ~80bp I-spread.
    const r = unwrap(
      calculateSimpleSpreads({
        bondYield: pct(0.038),
        yearsToMaturity: 3,
        curve,
      })
    );
    expect(r.iSpread.asDecimal).toBeCloseTo(0.038 - 0.03, 10);
    expect(r.gSpread).toBeUndefined();
  });

  it("adds a G-spread when a government curve is supplied", () => {
    const swap = sampleCurve();
    const govvie = unwrap(
      DiscountCurve.fromZeroRates([
        { tenor: 1, rate: pct(0.02) },
        { tenor: 3, rate: pct(0.025) },
        { tenor: 5, rate: pct(0.03) },
      ])
    );
    const r = unwrap(
      calculateSimpleSpreads({
        bondYield: pct(0.038),
        yearsToMaturity: 3,
        curve: swap,
        govvieCurve: govvie,
      })
    );
    expect(r.iSpread.asDecimal).toBeCloseTo(0.038 - 0.03, 10);
    expect(r.gSpread!.asDecimal).toBeCloseTo(0.038 - 0.025, 10);
  });
});
