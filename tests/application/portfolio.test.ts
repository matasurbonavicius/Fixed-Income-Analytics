/**
 * Portfolio aggregation tests. A portfolio holding both Bloomberg-pinned
 * fixture bonds is run through PortfolioCalculationService, then the
 * aggregate metrics are checked against invariants (sum of parts, weighted
 * bounds, non-empty schedule) rather than invented constants. The standalone
 * pure aggregation functions are exercised against the *calculated* positions.
 */
import { describe, it, expect } from "vitest";
import { PortfolioCalculationService } from "@application/core";
import { Portfolio, PortfolioPosition } from "@domain/entities";
import { MarketData, MarketDataStore } from "@domain/dataStructures";
import { Currency, UTCDate } from "@domain/valueObjects";
import {
  calculateTotalMarketValue,
  calculatePortfolioDuration,
  calculatePortfolioCashFlows,
  calculateAverageDiscountRate,
} from "@domain/formulas";
import { unwrap } from "../helpers/result";
import { makeFixedRateBond, makeZeroCouponBond } from "../fixtures/bonds";

const EUR = unwrap(Currency.create("EUR"));

/**
 * Both fixtures price as of the same date (2026-01-16). Merge their per-bond
 * price points into one MarketData and build a single combined store so the
 * portfolio engine can resolve prices for both bonds at once — the per-bond
 * fixture stores cannot be reused directly.
 */
function buildPortfolioFixture() {
  const fixed = makeFixedRateBond();
  const zero = makeZeroCouponBond();

  const fixedMd = unwrap(fixed.marketDataStore.getLatest());
  const zeroMd = unwrap(zero.marketDataStore.getLatest());

  const combinedPrices = [
    ...(fixedMd.bondPrice ?? []),
    ...(zeroMd.bondPrice ?? []),
  ];

  // Bond-level price lookup keys off options.analysisDate (the as-of date),
  // while the portfolio currency converter keys off options.settlementDate.
  // Provide the merged prices under BOTH dates so each lookup resolves.
  const asOf: MarketData = { asOfDate: fixed.options.analysisDate, bondPrice: combinedPrices };
  const atSettle: MarketData = { asOfDate: fixed.options.settlementDate, bondPrice: combinedPrices };
  const marketDataStore = MarketDataStore.create([asOf, atSettle]);

  const positions: PortfolioPosition[] = [
    { bond: fixed.bond, quantity: 2 },
    { bond: zero.bond, quantity: 3 },
  ];

  const portfolio = Portfolio.create({
    id: "PF-TEST-1",
    name: "Test Portfolio",
    positions,
    baseCurrency: EUR,
  });

  // Both fixtures share identical options; either is fine for the portfolio.
  return { portfolio, marketDataStore, options: fixed.options };
}

describe("PortfolioCalculationService.calculate", () => {
  it("aggregates two bonds with no failed calculations", async () => {
    const { portfolio, marketDataStore, options } = buildPortfolioFixture();

    const { updatedPortfolio, portfolioCalculationSummary } = unwrap(
      await PortfolioCalculationService.calculate(
        portfolio,
        marketDataStore,
        options
      )
    );

    expect(portfolioCalculationSummary.failed).toBe(0);
    expect(portfolioCalculationSummary.successful).toBeGreaterThan(0);

    const metrics = updatedPortfolio.props.metrics!;
    expect(metrics).toBeDefined();
    expect(metrics.numberOfPositions).toBe(2);
  });

  it("total market value is positive and equals the sum of position market values", async () => {
    const { portfolio, marketDataStore, options } = buildPortfolioFixture();

    const { updatedPortfolio } = unwrap(
      await PortfolioCalculationService.calculate(
        portfolio,
        marketDataStore,
        options
      )
    );

    const total = updatedPortfolio.props.metrics!.totalMarketValue!;
    expect(total).toBeDefined();
    expect(total.amount).toBeGreaterThan(0);
    expect(total.currency.code).toBe("EUR");

    // Independently sum each position: faceValue × cleanPrice × quantity.
    let expectedSum = 0;
    for (const position of updatedPortfolio.props.positions) {
      const cleanPrice = position.bond.props.metrics!.cleanPrice!;
      const mv = unwrap(
        position.bond.props.faceValue.multiplyByPercentage(cleanPrice)
      );
      const scaled = unwrap(mv.multiply(position.quantity));
      expectedSum += scaled.amount;
    }

    expect(total.amount).toBeCloseTo(expectedSum, 2);
  });

  it("portfolio modified duration lies between the two bonds' individual durations", async () => {
    const { portfolio, marketDataStore, options } = buildPortfolioFixture();

    const { updatedPortfolio } = unwrap(
      await PortfolioCalculationService.calculate(
        portfolio,
        marketDataStore,
        options
      )
    );

    const durations = updatedPortfolio.props.positions.map(
      (p) => p.bond.props.metrics!.duration!.modifiedDuration
    );
    const minDur = Math.min(...durations);
    const maxDur = Math.max(...durations);

    const portfolioModified =
      updatedPortfolio.props.metrics!.portfolioDuration!.portfolioModifiedDuration;

    // A market-value-weighted average must fall within the constituent range.
    expect(portfolioModified).toBeGreaterThanOrEqual(minDur);
    expect(portfolioModified).toBeLessThanOrEqual(maxDur);
  });

  it("produces a non-empty aggregated cash flow schedule", async () => {
    const { portfolio, marketDataStore, options } = buildPortfolioFixture();

    const { updatedPortfolio } = unwrap(
      await PortfolioCalculationService.calculate(
        portfolio,
        marketDataStore,
        options
      )
    );

    const cashFlows = updatedPortfolio.props.metrics!.cashFlows!;
    expect(cashFlows).toBeDefined();
    expect(cashFlows.cashFlows.length).toBeGreaterThan(0);
    expect(cashFlows.numberOfBonds).toBe(2);
  });
});

describe("standalone portfolio aggregation functions", () => {
  /**
   * The pure functions require bonds whose per-bond metrics are already
   * populated, so we first run the full service and feed the calculated
   * positions back in.
   */
  async function calculatedPositions() {
    const { portfolio, marketDataStore, options } = buildPortfolioFixture();
    const { updatedPortfolio } = unwrap(
      await PortfolioCalculationService.calculate(
        portfolio,
        marketDataStore,
        options
      )
    );
    return updatedPortfolio.props.positions;
  }

  it("calculateTotalMarketValue sums quantity × clean price across positions", async () => {
    const positions = await calculatedPositions();

    const total = unwrap(
      calculateTotalMarketValue({ positions, baseCurrency: EUR })
    );
    expect(total.amount).toBeGreaterThan(0);
    expect(total.currency.code).toBe("EUR");
  });

  it("calculatePortfolioDuration returns a weighted duration within bond bounds", async () => {
    const positions = await calculatedPositions();

    const result = unwrap(
      calculatePortfolioDuration({ positions, baseCurrency: EUR })
    );

    const modifieds = positions.map(
      (p) => p.bond.props.metrics!.duration!.modifiedDuration
    );
    expect(result.portfolioModifiedDuration).toBeGreaterThanOrEqual(
      Math.min(...modifieds)
    );
    expect(result.portfolioModifiedDuration).toBeLessThanOrEqual(
      Math.max(...modifieds)
    );
    expect(result.portfolioMacaulayDuration).toBeGreaterThan(0);
    expect(result.portfolioDollarDuration.amount).not.toBe(0);
  });

  it("calculatePortfolioCashFlows aggregates non-empty cash flows", async () => {
    const positions = await calculatedPositions();

    const result = unwrap(
      calculatePortfolioCashFlows({
        portfolioId: "PF-TEST-1",
        positions,
        baseCurrency: EUR,
        settlementDate: unwrap(UTCDate.fromString("2026-01-20")),
      })
    );

    expect(result.cashFlows.length).toBeGreaterThan(0);
    expect(result.numberOfBonds).toBe(2);
    expect(result.baseCurrency.code).toBe("EUR");
  });

  it("calculateAverageDiscountRate returns a rate within the bonds' rate range", async () => {
    const positions = await calculatedPositions();

    const avg = unwrap(
      calculateAverageDiscountRate({ positions, baseCurrency: EUR })
    );

    const rates = positions.map(
      (p) => p.bond.props.metrics!.discountRate!.discountRate.asDecimal
    );
    expect(avg.asDecimal).toBeGreaterThanOrEqual(Math.min(...rates) - 1e-9);
    expect(avg.asDecimal).toBeLessThanOrEqual(Math.max(...rates) + 1e-9);
  });
});
