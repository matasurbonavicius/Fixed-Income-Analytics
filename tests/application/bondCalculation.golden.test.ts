/**
 * Golden-value tests: the engine's output is pinned to figures independently
 * computed in Bloomberg for two real Lithuanian government bonds. These prove
 * the math is *correct*, not merely internally consistent.
 */
import { describe, it, expect } from "vitest";
import { BondCalculationService } from "@application/core";
import { unwrap } from "../helpers/result";
import {
  makeFixedRateBond,
  makeZeroCouponBond,
  FIXED_GOLDEN,
  ZERO_GOLDEN,
} from "../fixtures/bonds";

describe("BondCalculationService — fixed-rate bond (LITHUN 3.5 07/03/31)", () => {
  it("matches Bloomberg metrics within tolerance", async () => {
    const { bond, marketDataStore, options } = makeFixedRateBond();
    const { updatedBond, calculationSummary } = unwrap(
      await BondCalculationService.calculate(bond, marketDataStore, options)
    );

    expect(calculationSummary.failed).toBe(0);

    const m = updatedBond.props.metrics!;
    expect(m).toBeDefined();

    // Prices — Bloomberg quotes 4 dp, so 1e-3 of a percentage point is ample.
    expect(m.dirtyPrice!.asPercent).toBeCloseTo(FIXED_GOLDEN.dirtyPricePercent, 3);
    expect(m.cleanPrice!.asPercent).toBeCloseTo(FIXED_GOLDEN.cleanPricePercent, 3);

    // Accrued interest — money amount (2 dp) and exact day count.
    expect(m.accruedInterest!.amountMoney.amount).toBeCloseTo(
      FIXED_GOLDEN.accruedInterestAmount,
      1
    );
    expect(m.accruedInterest!.accruedDays).toBe(FIXED_GOLDEN.accruedDays);

    // Modified duration — Bloomberg quotes 3 dp.
    expect(m.duration!.modifiedDuration).toBeCloseTo(FIXED_GOLDEN.modifiedDuration, 2);

    // Convexity is reported alongside duration and is positive for this bullet.
    expect(m.duration!.convexity).toBeGreaterThan(0);

    // Implied yield from price.
    expect(m.discountRate!.discountRate.asPercent).toBeCloseTo(
      FIXED_GOLDEN.discountRatePercent,
      3
    );
    expect(m.discountRate!.methodUsed).toBe("implied_from_price");

    // Spreads against the fixture's EUR curve. Z- and I-spread are close here
    // (a near-flat short-end curve over the bond's life) and both ~21bp.
    expect(m.spreads!.zSpread.asPercent).toBeCloseTo(FIXED_GOLDEN.zSpreadPercent, 2);
    expect(m.spreads!.iSpread.asPercent).toBeCloseTo(FIXED_GOLDEN.iSpreadPercent, 2);
    expect(m.spreads!.gSpread).toBeUndefined();
  });
});

describe("BondCalculationService — zero-coupon bond (LITHGB 0 03/03/28)", () => {
  it("matches Bloomberg metrics within tolerance", async () => {
    const { bond, marketDataStore, options } = makeZeroCouponBond();
    const { updatedBond, calculationSummary } = unwrap(
      await BondCalculationService.calculate(bond, marketDataStore, options)
    );

    expect(calculationSummary.failed).toBe(0);

    const m = updatedBond.props.metrics!;

    // A zero trades flat: clean == dirty, accrued is zero.
    expect(m.cleanPrice!.asPercent).toBeCloseTo(ZERO_GOLDEN.cleanPricePercent, 3);
    expect(m.dirtyPrice!.asPercent).toBeCloseTo(ZERO_GOLDEN.cleanPricePercent, 3);
    expect(m.accruedInterest!.amountMoney.amount).toBeCloseTo(ZERO_GOLDEN.accruedInterestAmount, 6);
    expect(m.accruedInterest!.accruedDays).toBe(0);

    expect(m.duration!.modifiedDuration).toBeCloseTo(ZERO_GOLDEN.modifiedDuration, 2);
    // The zero's implied yield lands ~0.3bp from Bloomberg (2.5970% vs 2.5998%),
    // a known sub-basis-point difference in zero-coupon yield convention. We hold
    // it to 0.5bp rather than papering over it with a looser bound.
    expect(m.discountRate!.discountRate.asPercent).toBeCloseTo(
      ZERO_GOLDEN.discountRatePercent,
      2
    );

    // For a zero, Z-spread and I-spread coincide (single flow at maturity).
    expect(m.spreads!.zSpread.asPercent).toBeCloseTo(ZERO_GOLDEN.zSpreadPercent, 2);
    expect(m.spreads!.iSpread.asPercent).toBeCloseTo(ZERO_GOLDEN.iSpreadPercent, 2);
    expect(m.spreads!.zSpread.asPercent).toBeCloseTo(m.spreads!.iSpread.asPercent, 6);
  });

  it("has Macaulay duration close to time-to-maturity for a zero", async () => {
    const { bond, marketDataStore, options } = makeZeroCouponBond();
    const { updatedBond } = unwrap(
      await BondCalculationService.calculate(bond, marketDataStore, options)
    );
    const m = updatedBond.props.metrics!;
    // Settlement 2026-01-20 → maturity 2028-03-03 ≈ 2.12 years.
    const t = m.duration!.macaulayDuration;
    expect(t).toBeGreaterThan(2.0);
    expect(t).toBeLessThan(2.2);

    // A zero's convexity is the closed form t(t + 1) / (1 + y)^2.
    const y = m.discountRate!.discountRate.asDecimal;
    expect(m.duration!.convexity).toBeCloseTo((t * (t + 1)) / (1 + y) ** 2, 8);
  });
});
