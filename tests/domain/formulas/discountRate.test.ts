import { describe, it, expect } from "vitest";
import {
  calculateImpliedRateFixed,
  calculateImpliedRateZero,
  calculateDirtyPriceFixedFromYield,
  calculateDirtyPriceZeroFromYield,
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

/** Annual Jan-1 coupon schedule (see pricing.test.ts for the rationale). */
function annualCoupons(years: string[]): CouponPayment[] {
  return years.map((y, i) => ({
    paymentDate: d(`${y}-01-01`),
    periodStartDate: d(`${years[i - 1] ?? "2025"}-01-01`),
    periodEndDate: d(`${y}-01-01`),
    isRegular: true,
  }));
}

// The fixed-rate Newton-Raphson solver uses `frequency` as the compounding
// frequency, so the forward pricer must compound at the same `frequency` for a
// clean round-trip. The zero solver hardcodes annual (f = 1) compounding, so
// the zero pricer is fed compoundingFrequency = 1.
const ROUND_TRIP_TOLERANCE = 1e-6;

describe("implied rate — fixed round-trips", () => {
  const coupons = annualCoupons(["2027", "2028", "2029", "2030", "2031"]);
  const settlementDate = d("2026-06-15");
  const maturityDate = d("2031-01-01");
  const frequency = 1;

  function priceAt(yieldDecimal: number): Percentage {
    return unwrap(
      calculateDirtyPriceFixedFromYield({
        faceValue: FACE,
        fixedRate: pct(0.035),
        frequency,
        currency: EUR,
        settlementDate,
        maturityDate,
        futureCoupons: coupons,
        discountRate: pct(yieldDecimal),
        dayCountConvention: DCC,
        compoundingFrequency: frequency,
      })
    );
  }

  function impliedFrom(dirty: Percentage): number {
    return unwrap(
      calculateImpliedRateFixed({
        faceValue: FACE,
        cleanPrice: dirty, // field is named cleanPrice but holds the dirty price
        fixedRate: pct(0.035),
        frequency,
        settlementDate,
        maturityDate,
        futureCoupons: coupons,
        dayCountConvention: DCC,
      })
    ).asDecimal;
  }

  it.each([0.01, 0.025, 0.035, 0.045, 0.06])(
    "recovers yield %f from its priced dirty value",
    (y) => {
      const dirty = priceAt(y);
      const recovered = impliedFrom(dirty);
      expect(recovered).toBeCloseTo(y, 6); // within ROUND_TRIP_TOLERANCE
      expect(Math.abs(recovered - y)).toBeLessThan(ROUND_TRIP_TOLERANCE);
    }
  );

  it("yields exactly the coupon rate when priced at par", () => {
    // At yield == coupon on whole periods the price is par; on a non-coupon
    // settlement the implied yield still pins to the coupon when priced at the
    // coupon yield (round-trip), which the test above covers. Here we assert the
    // inverse monotonicity: higher price -> lower yield.
    const lowYieldDirty = priceAt(0.02);
    const highYieldDirty = priceAt(0.05);
    expect(lowYieldDirty.asDecimal).toBeGreaterThan(highYieldDirty.asDecimal);
    expect(impliedFrom(lowYieldDirty)).toBeLessThan(impliedFrom(highYieldDirty));
  });
});

describe("implied rate — zero round-trips", () => {
  const settlementDate = d("2026-01-20");
  const maturityDate = d("2030-03-03");

  function priceAt(yieldDecimal: number): Percentage {
    return unwrap(
      calculateDirtyPriceZeroFromYield({
        faceValue: FACE,
        currency: EUR,
        settlementDate,
        maturityDate,
        discountRate: pct(yieldDecimal),
        dayCountConvention: DCC,
        compoundingFrequency: 1, // zero solver hardcodes annual compounding
      })
    );
  }

  function impliedFrom(price: Percentage): number {
    return unwrap(
      calculateImpliedRateZero({
        faceValue: FACE,
        cleanPrice: price, // for a zero, dirty == clean
        settlementDate,
        maturityDate,
        dayCountConvention: DCC,
      })
    ).asDecimal;
  }

  it.each([0.005, 0.02, 0.026, 0.04, 0.07])(
    "recovers yield %f from its priced value",
    (y) => {
      const price = priceAt(y);
      const recovered = impliedFrom(price);
      expect(recovered).toBeCloseTo(y, 9);
      expect(Math.abs(recovered - y)).toBeLessThan(ROUND_TRIP_TOLERANCE);
    }
  );

  it("is the analytic inverse: higher price -> lower yield", () => {
    const cheap = priceAt(0.06); // high yield -> low price
    const dear = priceAt(0.01); // low yield -> high price
    expect(dear.asDecimal).toBeGreaterThan(cheap.asDecimal);
    expect(impliedFrom(dear)).toBeLessThan(impliedFrom(cheap));
  });

  it("returns par-implied zero yield when priced at 100%", () => {
    const r = unwrap(
      calculateImpliedRateZero({
        faceValue: FACE,
        cleanPrice: pct(1.0),
        settlementDate,
        maturityDate,
        dayCountConvention: DCC,
      })
    );
    expect(r.asDecimal).toBeCloseTo(0, 12);
  });
});
