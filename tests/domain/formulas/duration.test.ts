/**
 * Duration & convexity math, tested directly on the domain functions.
 *
 * Dates fall on Jan-1 anniversaries so that with ACT/ACT (ISDA) every full
 * year contributes exactly 1.0 to the day count — the period counts are then
 * whole integers and the closed-form identities hold analytically, not just
 * to a loose tolerance.
 */
import { describe, it, expect } from "vitest";
import {
  calculateDurationFixed,
  calculateDurationZero,
  calculateDirtyPriceFixedFromYield,
  type CouponPayment,
} from "@domain/formulas";
import { Currency, Money, Percentage, UTCDate } from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";

// ---- shared builders -------------------------------------------------------

const EUR = unwrap(Currency.create("EUR"));

function d(iso: string): UTCDate {
  return unwrap(UTCDate.fromString(iso));
}

function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}

const FACE = unwrap(Money.create(1_000_000, EUR));
const DCC = "ACT_ACT" as const;

/** Annual coupons on Jan-1 anniversaries across the given years. */
function annualCoupons(years: string[]): CouponPayment[] {
  return years.map((y, i) => ({
    paymentDate: d(`${y}-01-01`),
    periodStartDate: d(`${years[i - 1] ?? "2025"}-01-01`),
    periodEndDate: d(`${y}-01-01`),
    isRegular: true,
  }));
}

// ---- zero-coupon -----------------------------------------------------------

describe("convexity — zero-coupon", () => {
  const base = {
    analyticalCurrency: EUR,
    faceValue: FACE,
    currency: EUR,
    cleanPrice: pct(0.94),
    settlementDate: d("2026-01-01"),
    maturityDate: d("2031-01-01"), // exactly 5 years under ACT/ACT
    dayCountConvention: DCC,
  };

  it("equals t(t + 1) / (1 + y)^2 in closed form", () => {
    const t = 5;
    const y = 0.03;
    const r = unwrap(calculateDurationZero({ ...base, discountRate: pct(y) }));
    const expected = (t * (t + 1)) / Math.pow(1 + y, 2);
    expect(r.convexity).toBeCloseTo(expected, 8);
  });

  it("dollar convexity is convexity scaled by market value", () => {
    const r = unwrap(calculateDurationZero({ ...base, discountRate: pct(0.03) }));
    // Market value = face × clean = 1,000,000 × 0.94.
    expect(r.dollarConvexity.amount).toBeCloseTo(r.convexity * 940_000, 4);
  });
});

// ---- fixed-rate ------------------------------------------------------------

describe("convexity — fixed-rate", () => {
  const base = {
    faceValue: FACE,
    fixedRate: pct(0.035),
    frequency: 1,
    currency: EUR,
    cleanPrice: pct(1.0),
    settlementDate: d("2026-01-01"),
    dayCountConvention: DCC,
    compoundingFrequency: 1,
  };

  const fiveYear = {
    ...base,
    yield: pct(0.035),
    maturityDate: d("2031-01-01"),
    futureCoupons: annualCoupons(["2027", "2028", "2029", "2030", "2031"]),
  };

  it("is positive for an option-free bullet bond", () => {
    const r = unwrap(calculateDurationFixed(fiveYear));
    expect(r.convexity).toBeGreaterThan(0);
  });

  it("rises with maturity, all else equal", () => {
    const short = unwrap(calculateDurationFixed(fiveYear));
    const long = unwrap(
      calculateDurationFixed({
        ...base,
        yield: pct(0.035),
        maturityDate: d("2036-01-01"),
        futureCoupons: annualCoupons([
          "2027", "2028", "2029", "2030", "2031",
          "2032", "2033", "2034", "2035", "2036",
        ]),
      })
    );
    expect(long.convexity).toBeGreaterThan(short.convexity);
  });

  it("dollar convexity is convexity scaled by market value", () => {
    const r = unwrap(calculateDurationFixed(fiveYear));
    // cleanPrice 100% → market value == face == 1,000,000.
    expect(r.dollarConvexity.amount).toBeCloseTo(r.convexity * 1_000_000, 2);
  });

  it("the second-order estimate beats duration alone against a full reprice", () => {
    // Reprice the 5y bond from par to a +100bp yield shock, then compare the
    // actual price move to the first- and second-order Taylor estimates.
    const y0 = 0.035;
    const dy = 0.01;
    const r = unwrap(calculateDurationFixed({ ...fiveYear, yield: pct(y0) }));

    const p0 = unwrap(
      calculateDirtyPriceFixedFromYield({ ...fiveYear, discountRate: pct(y0) })
    ).asDecimal;
    const p1 = unwrap(
      calculateDirtyPriceFixedFromYield({ ...fiveYear, discountRate: pct(y0 + dy) })
    ).asDecimal;
    const actualReturn = (p1 - p0) / p0;

    const firstOrder = -r.modifiedDuration * dy;
    const secondOrder = -r.modifiedDuration * dy + 0.5 * r.convexity * dy * dy;

    // The convexity term must move the estimate closer to the true reprice.
    expect(Math.abs(secondOrder - actualReturn)).toBeLessThan(
      Math.abs(firstOrder - actualReturn)
    );
  });
});
