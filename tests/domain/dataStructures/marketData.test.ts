/**
 * Tests for the MarketDataStore container and its lookup helpers:
 * yield-curve interpolation, credit-spread / internal-rating lookups,
 * bond-price (mid vs bid) resolution, getByDate / getLatest fallbacks,
 * and staleness checks. Interpolation is pinned to known arithmetic values.
 */
import { describe, it, expect } from "vitest";
import {
  MarketData,
  MarketDataStore,
  getYieldCurve,
  interpolateYieldCurve,
  getCreditSpread,
  getInternalRatingSpread,
  getMarketPrice,
} from "@domain/dataStructures";
import {
  Currency,
  CreditRating,
  Percentage,
  UTCDate,
} from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";
import { makeFixedRateBond } from "../../fixtures/bonds";

const EUR = unwrap(Currency.create("EUR"));
const USD = unwrap(Currency.create("USD"));

function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}

function d(iso: string): UTCDate {
  return unwrap(UTCDate.fromString(iso));
}

function eurCurve() {
  return {
    currency: EUR,
    points: [
      { tenor: 1, rate: pct(0.02) },
      { tenor: 5, rate: pct(0.03) },
      { tenor: 10, rate: pct(0.04) },
    ],
  };
}

describe("MarketDataStore", () => {
  it("getByDate returns the stored data for an exact date key", () => {
    const md: MarketData = { asOfDate: d("2026-01-16") };
    const store = MarketDataStore.create([md]);
    const result = store.getByDate(d("2026-01-16"));
    expect(result.success).toBe(true);
    expect(unwrap(result).asOfDate.toISOString()).toBe(
      d("2026-01-16").toISOString()
    );
  });

  it("getByDate fails when no data exists for the requested date", () => {
    const store = MarketDataStore.create([{ asOfDate: d("2026-01-16") }]);
    const result = store.getByDate(d("2026-02-01"));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No market data");
  });

  it("getLatest returns the most recent point by ISO date", () => {
    const store = MarketDataStore.create([
      { asOfDate: d("2026-01-10") },
      { asOfDate: d("2026-03-05") },
      { asOfDate: d("2026-02-01") },
    ]);
    const latest = unwrap(store.getLatest());
    expect(latest.asOfDate.toISOString()).toBe(d("2026-03-05").toISOString());
  });

  it("getLatest fails on an empty store", () => {
    const store = MarketDataStore.create([]);
    const result = store.getLatest();
    expect(result.success).toBe(false);
  });

  it("addMarketData returns a new store containing the added point (immutability)", () => {
    const original = MarketDataStore.create([{ asOfDate: d("2026-01-10") }]);
    const updated = original.addMarketData({ asOfDate: d("2026-04-01") });

    // original is unchanged
    expect(original.getByDate(d("2026-04-01")).success).toBe(false);
    // updated has both
    expect(updated.getByDate(d("2026-04-01")).success).toBe(true);
    expect(updated.getByDate(d("2026-01-10")).success).toBe(true);
    expect(updated).not.toBe(original);
  });

  it("getLatestWithinAge fails on an empty store", () => {
    const store = MarketDataStore.create([]);
    const result = store.getLatestWithinAge(10);
    expect(result.success).toBe(false);
  });

  it("getLatestWithinAge rejects stale data when latest predates the max age", () => {
    // Latest point is far in the past, so any small max age makes it stale.
    const store = MarketDataStore.create([{ asOfDate: d("2000-01-01") }]);
    const result = store.getLatestWithinAge(5);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("stale");
  });

  it("getLatestWithinAge accepts fresh data when within the max age", () => {
    const today = unwrap(UTCDate.today());
    const store = MarketDataStore.create([{ asOfDate: today }]);
    const result = store.getLatestWithinAge(1_000_000);
    expect(result.success).toBe(true);
  });
});

describe("getYieldCurve", () => {
  it("returns the curve matching the requested currency", () => {
    const md: MarketData = { asOfDate: d("2026-01-16"), yieldCurve: [eurCurve()] };
    const curve = unwrap(getYieldCurve(md, EUR));
    expect(curve.currency.code).toBe("EUR");
    expect(curve.points.length).toBe(3);
  });

  it("fails when no yield curves are present", () => {
    const md: MarketData = { asOfDate: d("2026-01-16") };
    const result = getYieldCurve(md, EUR);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No yield curves");
  });

  it("fails when no curve matches the currency", () => {
    const md: MarketData = { asOfDate: d("2026-01-16"), yieldCurve: [eurCurve()] };
    const result = getYieldCurve(md, USD);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("USD");
  });
});

describe("interpolateYieldCurve", () => {
  const curve = eurCurve();

  it("returns the exact-match rate within tolerance", () => {
    expect(unwrap(interpolateYieldCurve(curve, 5))).toBeCloseTo(0.03, 12);
  });

  it("linearly interpolates between two points", () => {
    // Midway between tenor 1 (2%) and tenor 5 (3%): tenor 3 -> 2.5%.
    expect(unwrap(interpolateYieldCurve(curve, 3))).toBeCloseTo(0.025, 12);
    // 7y between 5y(3%) and 10y(4%): t = 2/5 -> 3% + 0.4*1% = 3.4%.
    expect(unwrap(interpolateYieldCurve(curve, 7))).toBeCloseTo(0.034, 12);
  });

  it("flat-extrapolates before the first point", () => {
    expect(unwrap(interpolateYieldCurve(curve, 0.25))).toBeCloseTo(0.02, 12);
  });

  it("flat-extrapolates after the last point", () => {
    expect(unwrap(interpolateYieldCurve(curve, 30))).toBeCloseTo(0.04, 12);
  });

  it("sorts unordered points before interpolating", () => {
    const unsorted = {
      currency: EUR,
      points: [
        { tenor: 10, rate: pct(0.04) },
        { tenor: 1, rate: pct(0.02) },
        { tenor: 5, rate: pct(0.03) },
      ],
    };
    expect(unwrap(interpolateYieldCurve(unsorted, 3))).toBeCloseTo(0.025, 12);
  });

  it("fails on an empty point set", () => {
    const empty = { currency: EUR, points: [] };
    expect(interpolateYieldCurve(empty, 5).success).toBe(false);
  });

  it("fails on a negative tenor", () => {
    const result = interpolateYieldCurve(curve, -1);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("negative");
  });
});

describe("getCreditSpread", () => {
  const rating = unwrap(CreditRating.create("A"));

  it("returns the spread matching rating and currency", () => {
    const md: MarketData = {
      asOfDate: d("2026-01-16"),
      creditSpread: [{ rating, currency: EUR, spread: 0.0015 }],
    };
    expect(unwrap(getCreditSpread(md, rating, EUR))).toBeCloseTo(0.0015, 12);
  });

  it("fails when no credit spread data exists", () => {
    const md: MarketData = { asOfDate: d("2026-01-16") };
    expect(getCreditSpread(md, rating, EUR).success).toBe(false);
  });

  it("fails when rating/currency does not match", () => {
    const md: MarketData = {
      asOfDate: d("2026-01-16"),
      creditSpread: [{ rating, currency: EUR, spread: 0.0015 }],
    };
    const result = getCreditSpread(md, rating, USD);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No credit spread");
  });
});

describe("getInternalRatingSpread", () => {
  const entry = { id: "rating-uuid-1", name: "BBB-equivalent", spreadBps: 150 };

  it("returns the entry matching the internal rating id", () => {
    const md: MarketData = {
      asOfDate: d("2026-01-16"),
      internalRatingSpread: [entry],
    };
    const found = unwrap(getInternalRatingSpread(md, "rating-uuid-1"));
    expect(found.spreadBps).toBe(150);
    expect(found.name).toBe("BBB-equivalent");
  });

  it("fails when no internal rating spread data exists", () => {
    const md: MarketData = { asOfDate: d("2026-01-16") };
    expect(getInternalRatingSpread(md, "x").success).toBe(false);
  });

  it("fails when the id does not match", () => {
    const md: MarketData = {
      asOfDate: d("2026-01-16"),
      internalRatingSpread: [entry],
    };
    const result = getInternalRatingSpread(md, "missing");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("missing");
  });
});

describe("getMarketPrice", () => {
  it("returns the bid when no ask is present", () => {
    const { bond } = makeFixedRateBond();
    const md: MarketData = {
      asOfDate: d("2026-01-16"),
      bondPrice: [{ bondId: bond.props.id, priceType: "clean", bid: pct(1.02) }],
    };
    const price = unwrap(getMarketPrice(bond, md, "clean"));
    expect(price.asDecimal).toBeCloseTo(1.02, 12);
  });

  it("returns the mid (average of bid and ask) when both are present", () => {
    const { bond } = makeFixedRateBond();
    const md: MarketData = {
      asOfDate: d("2026-01-16"),
      bondPrice: [
        { bondId: bond.props.id, priceType: "clean", bid: pct(1.0), ask: pct(1.04) },
      ],
    };
    const price = unwrap(getMarketPrice(bond, md, "clean"));
    expect(price.asDecimal).toBeCloseTo(1.02, 12);
  });

  it("fails when no price of the requested type exists for the bond", () => {
    const { bond } = makeFixedRateBond();
    const md: MarketData = {
      asOfDate: d("2026-01-16"),
      bondPrice: [{ bondId: bond.props.id, priceType: "clean", bid: pct(1.02) }],
    };
    const result = getMarketPrice(bond, md, "dirty");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("dirty");
  });
});
