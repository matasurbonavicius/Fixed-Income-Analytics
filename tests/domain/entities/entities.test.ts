/**
 * Tests for the Bond and Portfolio entities: currency conversion math,
 * metrics clearing, and immutable updates.
 */
import { describe, it, expect } from "vitest";
import { Portfolio, PortfolioPosition } from "@domain/entities";
import { Currency } from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";
import { makeFixedRateBond } from "../../fixtures/bonds";

const EUR = unwrap(Currency.create("EUR"));
const USD = unwrap(Currency.create("USD"));

describe("Bond.convertCurrency", () => {
  it("is a no-op (same instance) when already in the target currency", () => {
    const { bond } = makeFixedRateBond();
    const result = bond.convertCurrency(EUR, 1.1);
    expect(result.success).toBe(true);
    expect(unwrap(result)).toBe(bond);
  });

  it("converts the face value and stamps the new analytical currency", () => {
    const { bond } = makeFixedRateBond();
    const originalFace = bond.props.faceValue.amount;
    const converted = unwrap(bond.convertCurrency(USD, 1.1));

    expect(converted.props.analyticalCurrency.code).toBe("USD");
    expect(converted.props.faceValue.currency.code).toBe("USD");
    expect(converted.props.faceValue.amount).toBeCloseTo(originalFace * 1.1, 6);
    // original is untouched
    expect(bond.props.analyticalCurrency.code).toBe("EUR");
  });

  it("clears metrics when converting", () => {
    const { bond } = makeFixedRateBond();
    const withMetrics = bond.update({ metrics: {} as any });
    const converted = unwrap(withMetrics.convertCurrency(USD, 1.1));
    expect(converted.props.metrics).toBeUndefined();
  });

  it("rejects a non-positive FX rate", () => {
    const { bond } = makeFixedRateBond();
    const result = bond.convertCurrency(USD, 0);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Invalid FX rate");
  });

  it("rejects a non-finite FX rate", () => {
    const { bond } = makeFixedRateBond();
    expect(bond.convertCurrency(USD, Infinity).success).toBe(false);
    expect(bond.convertCurrency(USD, NaN).success).toBe(false);
  });
});

describe("Bond.update / deleteMetrics", () => {
  it("update merges fields immutably", () => {
    const { bond } = makeFixedRateBond();
    const updated = bond.update({ settlementDays: 3 });
    expect(updated.props.settlementDays).toBe(3);
    expect(bond.props.settlementDays).toBe(2);
    expect(updated).not.toBe(bond);
  });

  it("deleteMetrics strips the metrics field", () => {
    const { bond } = makeFixedRateBond();
    const withMetrics = bond.update({ metrics: {} as any });
    expect(withMetrics.props.metrics).toBeDefined();
    const stripped = withMetrics.deleteMetrics();
    expect(stripped.props.metrics).toBeUndefined();
  });
});

describe("Portfolio", () => {
  function buildPortfolio() {
    const { bond } = makeFixedRateBond();
    const withMetrics = bond.update({ metrics: { fake: true } as any });
    const positions: PortfolioPosition[] = [{ bond: withMetrics, quantity: 2 }];
    return Portfolio.create({
      id: "PF-1",
      name: "Test",
      positions,
      baseCurrency: EUR,
      metrics: { portfolioId: "PF-1" } as any,
    });
  }

  it("update merges fields immutably", () => {
    const pf = buildPortfolio();
    const renamed = pf.update({ name: "Renamed" });
    expect(renamed.props.name).toBe("Renamed");
    expect(pf.props.name).toBe("Test");
    expect(renamed).not.toBe(pf);
  });

  it("deleteAllMetrics clears portfolio metrics and every bond's metrics", () => {
    const pf = buildPortfolio();
    expect(pf.props.metrics).toBeDefined();
    expect(pf.props.positions[0].bond.props.metrics).toBeDefined();

    const cleared = pf.deleteAllMetrics();
    expect(cleared.props.metrics).toBeUndefined();
    expect(cleared.props.positions[0].bond.props.metrics).toBeUndefined();
    // quantity preserved
    expect(cleared.props.positions[0].quantity).toBe(2);
  });
});
