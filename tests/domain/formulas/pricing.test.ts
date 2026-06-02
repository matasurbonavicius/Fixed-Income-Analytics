import { describe, it, expect } from "vitest";
import {
  calculateAccruedInterestFixed,
  calculateAccruedInterestZero,
  generateCashFlowsFixed,
  generateCashFlowsZero,
  calculateDirtyPriceFixedFromYield,
  calculateDirtyPriceZeroFromYield,
  calculateDirtyPriceFixedFromCurve,
  calculateDirtyPriceZeroFromCurve,
  calculateCleanPriceFixedFromDirty,
  calculateCleanPriceZeroFromDirty,
  type CouponPayment,
} from "@domain/formulas";
import { Currency, Money, Percentage, UTCDate, DiscountCurve } from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";

// ---- shared builders -------------------------------------------------------

const EUR = unwrap(Currency.create("EUR"));

/** UTCDate from an ISO date string, asserting success. */
function d(iso: string): UTCDate {
  return unwrap(UTCDate.fromString(iso));
}

/** Percentage from a decimal (0.035 = 3.5%). */
function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}

const FACE = unwrap(Money.create(1_000_000, EUR));

/**
 * Annual coupon schedule on Jan-1 anniversaries. With ACT/ACT (ISDA) and
 * calendar-aligned dates each full year contributes exactly 1.0 to the day
 * count, which makes the par/round-trip math analytically clean.
 */
function annualCoupons(years: string[]): CouponPayment[] {
  return years.map((y, i) => ({
    paymentDate: d(`${y}-01-01`),
    periodStartDate: d(`${years[i - 1] ?? "2025"}-01-01`),
    periodEndDate: d(`${y}-01-01`),
    isRegular: true,
  }));
}

const DCC = "ACT_ACT" as const;

describe("accrued interest — fixed", () => {
  // 3.5% annual coupon, single coupon period 2026-01-01 → 2027-01-01.
  const base = {
    faceValue: FACE,
    fixedRate: pct(0.035),
    frequency: 1,
    periodStartDate: d("2026-01-01"),
    periodEndDate: d("2027-01-01"),
    dayCountConvention: DCC,
  };

  it("is zero at the start of a coupon period", () => {
    const r = unwrap(
      calculateAccruedInterestFixed({ ...base, settlementDate: d("2026-01-01") })
    );
    expect(r.amountPercent.asDecimal).toBeCloseTo(0, 12);
    expect(r.amountMoney.amount).toBeCloseTo(0, 6);
    expect(r.accruedDays).toBe(0);
  });

  it("reaches a full coupon at the end of the period (resets at coupon date)", () => {
    const r = unwrap(
      calculateAccruedInterestFixed({ ...base, settlementDate: d("2027-01-01") })
    );
    // Full period accrual == the periodic coupon = 3.5% of par.
    expect(r.amountPercent.asDecimal).toBeCloseTo(0.035, 10);
    expect(r.amountMoney.amount).toBeCloseTo(35_000, 4);
  });

  it("grows monotonically through the coupon period", () => {
    const dates = [
      "2026-01-01",
      "2026-04-01",
      "2026-07-01",
      "2026-10-01",
      "2027-01-01",
    ];
    const accrued = dates.map((s) =>
      unwrap(
        calculateAccruedInterestFixed({ ...base, settlementDate: d(s) })
      ).amountPercent.asDecimal
    );
    for (let i = 1; i < accrued.length; i++) {
      expect(accrued[i]).toBeGreaterThan(accrued[i - 1]);
    }
    // Bounded by the full periodic coupon.
    expect(accrued[accrued.length - 1]).toBeCloseTo(0.035, 10);
  });

  it("scales accrued days with the calendar", () => {
    const r = unwrap(
      calculateAccruedInterestFixed({ ...base, settlementDate: d("2026-07-02") })
    );
    // 2026-01-01 → 2026-07-02 is 182 days.
    expect(r.accruedDays).toBe(182);
  });
});

describe("accrued interest — zero", () => {
  it("is always zero", () => {
    const r = unwrap(calculateAccruedInterestZero(EUR, d("2026-06-15")));
    expect(r.amountPercent.asDecimal).toBe(0);
    expect(r.amountMoney.amount).toBe(0);
    expect(r.accruedDays).toBe(0);
  });
});

describe("cash flows — fixed", () => {
  const coupons = annualCoupons(["2027", "2028", "2029"]);
  const input = {
    bondId: "TEST-FIXED",
    faceValue: FACE,
    fixedRate: pct(0.035),
    frequency: 1,
    currency: EUR,
    settlementDate: d("2026-06-01"),
    maturityDate: d("2029-01-01"),
    futureCoupons: coupons,
    dayCountConvention: DCC,
  };

  it("emits one coupon per future coupon plus a principal flow", () => {
    const s = unwrap(generateCashFlowsFixed(input));
    const couponFlows = s.cashFlows.filter((c) => c.type === "COUPON");
    const principalFlows = s.cashFlows.filter((c) => c.type === "PRINCIPAL");
    expect(couponFlows).toHaveLength(coupons.length);
    expect(principalFlows).toHaveLength(1);
    // Each coupon is 3.5% of 1,000,000 = 35,000.
    for (const c of couponFlows) {
      expect(c.amount.amount).toBeCloseTo(35_000, 4);
    }
    // Final (largest-date) flow carries the principal.
    const principal = principalFlows[0];
    expect(principal.amount.amount).toBeCloseTo(1_000_000, 4);
    expect(principal.date.equals(d("2029-01-01"))).toBe(true);
  });

  it("totals inflows = sum of coupons + principal", () => {
    const s = unwrap(generateCashFlowsFixed(input));
    expect(s.totalInflows.amount).toBeCloseTo(
      coupons.length * 35_000 + 1_000_000,
      4
    );
  });

  it("adds a negative initial outflow when a dirty price is supplied", () => {
    const dirty = unwrap(Money.create(1_020_000, EUR));
    const s = unwrap(generateCashFlowsFixed({ ...input, dirtyPrice: dirty }));
    const outflow = s.cashFlows.find((c) => c.type === "INITIAL_OUTFLOW");
    expect(outflow).toBeDefined();
    expect(outflow!.amount.amount).toBeCloseTo(-1_020_000, 4);
    expect(outflow!.date.equals(input.settlementDate)).toBe(true);
    expect(s.totalOutflows.amount).toBeCloseTo(1_020_000, 4);
  });
});

describe("cash flows — zero", () => {
  const input = {
    bondId: "TEST-ZERO",
    faceValue: FACE,
    currency: EUR,
    settlementDate: d("2026-06-01"),
    maturityDate: d("2028-03-03"),
  };

  it("emits a single principal flow equal to face value", () => {
    const s = unwrap(generateCashFlowsZero(input));
    expect(s.cashFlows).toHaveLength(1);
    expect(s.cashFlows[0].type).toBe("PRINCIPAL");
    expect(s.cashFlows[0].amount.amount).toBeCloseTo(1_000_000, 4);
    expect(s.totalInflows.amount).toBeCloseTo(1_000_000, 4);
  });

  it("includes the purchase outflow when a dirty price is supplied", () => {
    const dirty = unwrap(Money.create(947_161.5, EUR));
    const s = unwrap(generateCashFlowsZero({ ...input, dirtyPrice: dirty }));
    expect(s.cashFlows).toHaveLength(2);
    const outflow = s.cashFlows.find((c) => c.type === "INITIAL_OUTFLOW");
    expect(outflow!.amount.amount).toBeCloseTo(-947_161.5, 4);
    expect(s.netCashFlow.amount).toBeCloseTo(1_000_000 - 947_161.5, 4);
  });
});

describe("dirty/clean price — fixed", () => {
  const coupons = annualCoupons(["2027", "2028", "2029", "2030", "2031"]);
  const onCoupon = {
    faceValue: FACE,
    fixedRate: pct(0.035),
    frequency: 1,
    currency: EUR,
    settlementDate: d("2026-01-01"),
    maturityDate: d("2031-01-01"),
    futureCoupons: coupons,
    dayCountConvention: DCC,
    compoundingFrequency: 1,
  };

  it("prices at par when yield == coupon on a coupon date", () => {
    const dirty = unwrap(
      calculateDirtyPriceFixedFromYield({ ...onCoupon, discountRate: pct(0.035) })
    );
    expect(dirty.asDecimal).toBeCloseTo(1.0, 8);
  });

  it("trades at a premium when yield < coupon", () => {
    const dirty = unwrap(
      calculateDirtyPriceFixedFromYield({ ...onCoupon, discountRate: pct(0.025) })
    );
    expect(dirty.asDecimal).toBeGreaterThan(1.0);
  });

  it("trades at a discount when yield > coupon", () => {
    const dirty = unwrap(
      calculateDirtyPriceFixedFromYield({ ...onCoupon, discountRate: pct(0.045) })
    );
    expect(dirty.asDecimal).toBeLessThan(1.0);
  });

  it("clean = dirty - accrued (equal on a coupon date where accrued == 0)", () => {
    const dirty = unwrap(
      calculateDirtyPriceFixedFromYield({ ...onCoupon, discountRate: pct(0.04) })
    );
    const accrued = unwrap(
      calculateAccruedInterestFixed({
        faceValue: FACE,
        fixedRate: pct(0.035),
        frequency: 1,
        periodStartDate: d("2026-01-01"),
        periodEndDate: d("2027-01-01"),
        settlementDate: d("2026-01-01"),
        dayCountConvention: DCC,
      })
    );
    const clean = unwrap(
      calculateCleanPriceFixedFromDirty({ dirtyPrice: dirty, accruedInterest: accrued })
    );
    // On a coupon date accrued interest is zero, so clean == dirty.
    expect(clean.asDecimal).toBeCloseTo(dirty.asDecimal, 12);
  });

  it("clean is strictly below dirty mid-period (positive accrued)", () => {
    // Settle mid-period: dirty priced from a yield, accrued > 0.
    const midCoupons = annualCoupons(["2027", "2028", "2029", "2030", "2031"]);
    const dirty = unwrap(
      calculateDirtyPriceFixedFromYield({
        ...onCoupon,
        settlementDate: d("2026-07-02"),
        futureCoupons: midCoupons,
        discountRate: pct(0.04),
      })
    );
    const accrued = unwrap(
      calculateAccruedInterestFixed({
        faceValue: FACE,
        fixedRate: pct(0.035),
        frequency: 1,
        periodStartDate: d("2026-01-01"),
        periodEndDate: d("2027-01-01"),
        settlementDate: d("2026-07-02"),
        dayCountConvention: DCC,
      })
    );
    const clean = unwrap(
      calculateCleanPriceFixedFromDirty({ dirtyPrice: dirty, accruedInterest: accrued })
    );
    expect(accrued.amountPercent.asDecimal).toBeGreaterThan(0);
    expect(clean.asDecimal).toBeLessThan(dirty.asDecimal);
    expect(clean.asDecimal).toBeCloseTo(
      dirty.asDecimal - accrued.amountPercent.asDecimal,
      12
    );
  });
});

describe("dirty/clean price — zero", () => {
  const base = {
    faceValue: FACE,
    currency: EUR,
    settlementDate: d("2026-01-20"),
    maturityDate: d("2028-03-03"),
    dayCountConvention: DCC,
    compoundingFrequency: 1,
  };

  it("prices below par for a positive yield", () => {
    const dirty = unwrap(
      calculateDirtyPriceZeroFromYield({ ...base, discountRate: pct(0.026) })
    );
    expect(dirty.asDecimal).toBeLessThan(1.0);
    expect(dirty.asDecimal).toBeGreaterThan(0);
  });

  it("clean price equals dirty price (no accrued interest)", () => {
    const dirty = unwrap(
      calculateDirtyPriceZeroFromYield({ ...base, discountRate: pct(0.026) })
    );
    const clean = unwrap(calculateCleanPriceZeroFromDirty({ dirtyPrice: dirty }));
    expect(clean.asDecimal).toBe(dirty.asDecimal);
  });
});

// ---- curve discounting reproduces the flat-yield price ---------------------
//
// The regression guard for Phase 2: discounting off a *flat* curve at rate y
// must reproduce, to ~1e-10, the flat-yield price at y. This proves the
// curve-mode and yield-mode paths agree in the flat case (both use discrete
// annual compounding) and that nothing silently diverges.

/** A flat discount curve at a single rate. */
function flatCurve(rate: number): DiscountCurve {
  return unwrap(
    DiscountCurve.fromZeroRates([
      { tenor: 1, rate: pct(rate) },
      { tenor: 30, rate: pct(rate) },
    ])
  );
}

describe("curve pricing reproduces flat-yield pricing", () => {
  it("fixed: flat curve == flat yield (annual compounding)", () => {
    const coupons = annualCoupons(["2027", "2028", "2029", "2030", "2031"]);
    const common = {
      faceValue: FACE,
      fixedRate: pct(0.035),
      frequency: 1,
      currency: EUR,
      settlementDate: d("2026-01-01"),
      maturityDate: d("2031-01-01"),
      futureCoupons: coupons,
      dayCountConvention: DCC,
    };
    for (const y of [0.025, 0.035, 0.05]) {
      const fromYield = unwrap(
        calculateDirtyPriceFixedFromYield({
          ...common,
          discountRate: pct(y),
          compoundingFrequency: 1,
        })
      );
      const fromCurve = unwrap(
        calculateDirtyPriceFixedFromCurve({ ...common, curve: flatCurve(y) })
      );
      expect(fromCurve.asDecimal).toBeCloseTo(fromYield.asDecimal, 10);
    }
  });

  it("zero: flat curve == flat yield (annual compounding)", () => {
    const common = {
      faceValue: FACE,
      currency: EUR,
      settlementDate: d("2026-01-20"),
      maturityDate: d("2028-03-03"),
      dayCountConvention: DCC,
    };
    for (const y of [0.02, 0.026, 0.04]) {
      const fromYield = unwrap(
        calculateDirtyPriceZeroFromYield({
          ...common,
          discountRate: pct(y),
          compoundingFrequency: 1,
        })
      );
      const fromCurve = unwrap(
        calculateDirtyPriceZeroFromCurve({ ...common, curve: flatCurve(y) })
      );
      expect(fromCurve.asDecimal).toBeCloseTo(fromYield.asDecimal, 10);
    }
  });
});
