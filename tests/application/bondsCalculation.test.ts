/**
 * Smoke tests for BondsCalculationService — the multi-bond / multi-date
 * orchestration entry point. These check that the happy path runs end to end
 * and aggregates correctly (no big cracks); the per-bond math is pinned by the
 * golden tests, so we don't re-check figures or edge cases here.
 */
import { describe, it, expect } from "vitest";
import { BondsCalculationService } from "@application/core";
import { MarketData } from "@domain/dataStructures";
import { unwrap } from "../helpers/result";
import { makeFixedRateBond, makeZeroCouponBond } from "../fixtures/bonds";

/**
 * Both fixtures price as of the same date; merge their per-bond price points
 * into one MarketData so a single store resolves prices for both bonds.
 */
function buildMarketData(): MarketData {
  const fixed = makeFixedRateBond();
  const zero = makeZeroCouponBond();

  const fixedMd = unwrap(fixed.marketDataStore.getLatest());
  const zeroMd = unwrap(zero.marketDataStore.getLatest());

  return {
    asOfDate: fixedMd.asOfDate,
    bondPrice: [...(fixedMd.bondPrice ?? []), ...(zeroMd.bondPrice ?? [])],
  };
}

const bonds = () => [makeFixedRateBond().bond, makeZeroCouponBond().bond];

describe("BondsCalculationService.calculateForDate", () => {
  it("calculates both bonds for a single date with no failures", async () => {
    const result = unwrap(
      await BondsCalculationService.calculateForDate(bonds(), buildMarketData())
    );

    expect(result.stats.total).toBe(2);
    expect(result.stats.success).toBe(2);
    expect(result.stats.failed).toBe(0);
    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.success && r.bond)).toBe(true);
  });

  it("invokes the per-bond progress callback once per bond", async () => {
    let calls = 0;
    await BondsCalculationService.calculateForDate(bonds(), buildMarketData(), {
      onBondProgress: () => calls++,
    });
    expect(calls).toBe(2);
  });
});

describe("BondsCalculationService.calculateForAllDates", () => {
  it("aggregates across multiple dates", async () => {
    const md = buildMarketData();
    const byDate = new Map<string, MarketData>([
      ["2026-01-16", md],
      ["2026-01-15", { ...md, asOfDate: unwrap(md.asOfDate.addDays(-1)) }],
    ]);

    const result = unwrap(
      await BondsCalculationService.calculateForAllDates(bonds(), byDate)
    );

    expect(result.stats.totalDates).toBe(2);
    expect(result.stats.totalBonds).toBe(2);
    expect(result.stats.totalCalculations).toBe(4);
    expect(result.stats.successfulCalculations).toBe(4);
    expect(result.stats.failedCalculations).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.dateResults).toHaveLength(2);
  });
});
