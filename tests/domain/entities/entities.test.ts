/**
 * Entity tests, kept thin. The entities are mostly immutable prop bags exercised
 * end-to-end by the service and currency-converter suites; we keep only the two
 * invariants that carry real logic and are easy to break silently:
 *   1. converting a bond's currency must clear its (now stale) metrics, and
 *   2. clearing a portfolio's metrics must cascade to every constituent bond.
 */
import { describe, it, expect } from "vitest";
import { Portfolio, PortfolioPosition } from "@domain/entities";
import { Currency } from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";
import { makeFixedRateBond } from "../../fixtures/bonds";

const EUR = unwrap(Currency.create("EUR"));
const USD = unwrap(Currency.create("USD"));

describe("Bond.convertCurrency", () => {
  it("converts the face value, stamps the new currency, and clears stale metrics", () => {
    const { bond } = makeFixedRateBond();
    const withMetrics = bond.update({ metrics: {} as any });
    const originalFace = bond.props.faceValue.amount;

    const converted = unwrap(withMetrics.convertCurrency(USD, 1.1));

    expect(converted.props.analyticalCurrency.code).toBe("USD");
    expect(converted.props.faceValue.amount).toBeCloseTo(originalFace * 1.1, 6);
    expect(converted.props.metrics).toBeUndefined(); // metrics invalidated by FX
    // original untouched
    expect(bond.props.analyticalCurrency.code).toBe("EUR");
  });

  it("is a no-op when already in the target currency and rejects bad FX rates", () => {
    const { bond } = makeFixedRateBond();
    expect(unwrap(bond.convertCurrency(EUR, 1.1))).toBe(bond);
    expect(bond.convertCurrency(USD, 0).success).toBe(false);
    expect(bond.convertCurrency(USD, NaN).success).toBe(false);
  });
});

describe("Portfolio.deleteAllMetrics", () => {
  it("clears portfolio metrics and cascades to every bond's metrics", () => {
    const { bond } = makeFixedRateBond();
    const withMetrics = bond.update({ metrics: { fake: true } as any });
    const positions: PortfolioPosition[] = [{ bond: withMetrics, quantity: 2 }];
    const pf = Portfolio.create({
      id: "PF-1",
      name: "Test",
      positions,
      baseCurrency: EUR,
      metrics: { portfolioId: "PF-1" } as any,
    });

    const cleared = pf.deleteAllMetrics();

    expect(cleared.props.metrics).toBeUndefined();
    expect(cleared.props.positions[0].bond.props.metrics).toBeUndefined();
    expect(cleared.props.positions[0].quantity).toBe(2); // quantity preserved
  });
});
