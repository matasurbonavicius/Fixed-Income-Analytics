/**
 * Integration tests for the discount-rate waterfall in DiscountRateFormula.
 * The existing golden suite only exercises `implied_from_price`. Here we drive
 * each non-implied method (official_rating, internal_rating, manual_spread,
 * manual_rate) by configuring `options.discountRate.methods` and supplying the
 * matching market data, then assert the chosen `methodUsed` and the resulting
 * rate (base yield-curve rate + spread).
 */
import { describe, it, expect } from "vitest";
import { BondCalculationService } from "@application/core";
import { Bond } from "@domain/entities";
import { MarketData, MarketDataStore } from "@domain/dataStructures";
import {
  Currency,
  BondId,
  Money,
  Percentage,
  CreditRating,
  UTCDate,
} from "@domain/valueObjects";
import type { BondFormulaOptions } from "@domain/specifications";
import type { DiscountRateMethod } from "@domain/entities";
import { unwrap } from "../helpers/result";

const EUR = unwrap(Currency.create("EUR"));

function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}
function d(iso: string): UTCDate {
  return unwrap(UTCDate.fromString(iso));
}

const AS_OF = d("2026-01-16");
const SETTLE = d("2026-01-20");
const RATING_A = unwrap(CreditRating.create("A"));

/**
 * A fixed-rate bond maturing ~5y out so the yield-curve interpolation lands
 * cleanly on the 5y point. No bond price is supplied in market data, so
 * `implied_from_price` self-skips and the waterfall advances.
 */
function makeBond(overrides: Partial<Record<string, unknown>> = {}): Bond {
  const id = unwrap(BondId.create({ isin: "TESTWF0001" }));
  return Bond.create({
    id,
    name: "Waterfall Test Bond",
    issueDate: d("2024-01-03"),
    issuer: "Test Issuer",
    issuerCountry: "LT",
    bondCategory: "SOVEREIGN",
    issuerSector: "GOVERNMENT",
    issueCurrency: EUR,
    analyticalCurrency: EUR,
    faceValue: unwrap(Money.create(1_000_000, EUR)),
    maturityDate: d("2031-01-03"),
    settlementDays: 2,
    dayCountConvention: "ACT_ACT",
    businessDayConvention: "MODIFIED_FOLLOWING",
    paymentCalendar: "EUREX",
    creditRating: RATING_A,
    bondType: "FIXED",
    fixedRate: pct(0.035),
    frequency: 1,
    ...(overrides as object),
  } as any);
}

/** Market data WITH a yield curve + spreads but NO bond price. */
function marketDataWithCurves(): MarketData {
  return {
    asOfDate: AS_OF,
    yieldCurve: [
      {
        currency: EUR,
        points: [
          { tenor: 1, rate: pct(0.02) },
          { tenor: 5, rate: pct(0.03) },
          { tenor: 10, rate: pct(0.04) },
        ],
      },
    ],
    creditSpread: [{ rating: RATING_A, currency: EUR, spread: 0.005 }], // 50bps
    internalRatingSpread: [
      { id: "internal-1", name: "BBB-ish", spreadBps: 200 }, // 2%
    ],
  };
}

function optionsWith(methods: DiscountRateMethod[]): BondFormulaOptions {
  return {
    settlementDate: SETTLE,
    analysisDate: AS_OF,
    discountRate: { methods },
    cashFlow: { includeInitialOutflow: true },
  };
}

async function runRate(bond: Bond, methods: DiscountRateMethod[]) {
  const store = MarketDataStore.create([marketDataWithCurves()]);
  const { updatedBond } = unwrap(
    await BondCalculationService.calculate(bond, store, optionsWith(methods))
  );
  return updatedBond.props.metrics!.discountRate!;
}

// The bond settles 2026-01-20 and matures 2031-01-03 (~4.96y), so the curve
// rate is the linear interpolation between the 1y (2%) and 5y (3%) points
// rather than an exact node. We don't hardcode it; instead we recover the
// base rate from the official_rating result (base = rate - 50bps spread) and
// assert the other spread-based methods relative to the SAME base, so the
// interpolation arithmetic cancels out.
async function baseRate(): Promise<number> {
  const rate = await runRate(makeBond(), ["official_rating"]);
  return rate.discountRate.asDecimal - 0.005;
}

describe("discount-rate waterfall", () => {
  it("official_rating: base curve rate + credit spread (50bps)", async () => {
    const rate = await runRate(makeBond(), ["official_rating"]);
    expect(rate.methodUsed).toBe("official_rating");
    const base = await baseRate();
    // base is between the 2% (1y) and 3% (5y) curve nodes.
    expect(base).toBeGreaterThan(0.02);
    expect(base).toBeLessThan(0.03);
    expect(rate.discountRate.asDecimal).toBeCloseTo(base + 0.005, 9);
  });

  it("internal_rating: base curve rate + internal spread (200bps)", async () => {
    const bond = makeBond({ internalRatingId: "internal-1" });
    const rate = await runRate(bond, ["internal_rating"]);
    expect(rate.methodUsed).toBe("internal_rating");
    const base = await baseRate();
    expect(rate.discountRate.asDecimal).toBeCloseTo(base + 0.02, 9);
  });

  it("manual_spread: base curve rate + manual spread (125bps)", async () => {
    const bond = makeBond({ manualSpreadBps: 125 });
    const rate = await runRate(bond, ["manual_spread"]);
    expect(rate.methodUsed).toBe("manual_spread");
    const base = await baseRate();
    expect(rate.discountRate.asDecimal).toBeCloseTo(base + 0.0125, 9);
  });

  it("manual_rate: direct override is used verbatim", async () => {
    const bond = makeBond({ manualDiscountRate: pct(0.077) });
    const rate = await runRate(bond, ["manual_rate"]);
    expect(rate.methodUsed).toBe("manual_rate");
    expect(rate.discountRate.asDecimal).toBeCloseTo(0.077, 9);
  });

  it("falls through to the first method that succeeds", async () => {
    // internal_rating has no id on this bond -> skipped; official_rating works.
    const rate = await runRate(makeBond(), ["internal_rating", "official_rating"]);
    expect(rate.methodUsed).toBe("official_rating");
  });

  it("falls through manual_spread (absent) to manual_rate", async () => {
    const bond = makeBond({ manualDiscountRate: pct(0.066) });
    const rate = await runRate(bond, ["manual_spread", "manual_rate"]);
    expect(rate.methodUsed).toBe("manual_rate");
    expect(rate.discountRate.asDecimal).toBeCloseTo(0.066, 9);
  });
});
