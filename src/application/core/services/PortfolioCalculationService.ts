import { Portfolio, PortfolioMetrics } from "@domain/entities";
import { MarketDataStore } from "@domain/dataStructures";
import { CalculationEngine, EngineSummary } from "../CalculationEngine";
import { Result, ResultHelper } from "@domain/shared";
import { BondFormulaOptions } from "@domain/specifications";
import { BondId, UTCDate } from "@domain/valueObjects";
import { ALL_PORTFOLIO_FORMULAS } from "@application/formulas";
import { PortfolioCurrencyConverter } from "../utils";
import { BondCalculationService } from "./BondCalculationService";

/**
 * The successful outcome of {@link PortfolioCalculationService.calculate}.
 *
 * @category Results & Types
 */
export interface PortfolioCalculationServiceReturn {
  /**
   * A new {@link Portfolio} whose positions have been converted to the base
   * currency, whose bonds carry metrics, and which carries portfolio-level
   * `metrics`. The input portfolio is never mutated.
   */
  updatedPortfolio: Portfolio;
  /**
   * One {@link EngineSummary} per bond whose metrics were computed during this
   * run, keyed by {@link BondId}. Bonds that already had metrics are omitted.
   */
  bondCalculationSummaries: { bondId: BondId; engineSummary: EngineSummary }[];
  /** Summary for the portfolio-level aggregation pass. */
  portfolioCalculationSummary: EngineSummary;
}

/**
 * Computes portfolio-level analytics by valuing each holding then aggregating.
 *
 * The calculation runs in two passes. First every position's {@link Bond} is
 * converted into the portfolio's base currency (using FX rates from the market
 * data) and given metrics via {@link BondCalculationService} if it lacks them.
 * Then a {@link CalculationEngine} runs {@link ALL_PORTFOLIO_FORMULAS} over the
 * prepared portfolio to produce aggregate measures - total market value,
 * portfolio duration, average discount rate and netted cash flows - all
 * expressed in the base currency. Successful formula results are mapped onto a
 * `PortfolioMetrics` object by matching formula id to property name.
 *
 * @remarks
 * For a single bond use {@link BondCalculationService}; for a flat list of
 * bonds without aggregation use {@link BondsCalculationService}.
 *
 * @category Services
 */
export class PortfolioCalculationService {
  /**
   * Values a portfolio and returns a fully-populated copy.
   *
   * Never throws and never mutates `portfolio`. The base-currency conversion
   * must succeed for the run to proceed; thereafter the aggregation fails
   * outright only when *every* portfolio formula fails - if at least one
   * succeeds the call returns success with the remaining failures recorded in
   * {@link EngineSummary.failureReasons}. Bonds that already carry metrics are
   * reused as-is; only the rest are recomputed.
   *
   * @param portfolio - The {@link Portfolio} to value. Read-only; left
   *   unmodified.
   * @param marketDataStore - Prices, curves, spreads and FX rates the per-bond
   *   and portfolio formulas read from.
   * @param options - Settlement/analysis dates and discount-rate and cash-flow
   *   settings (see {@link BondFormulaOptions}); `settlementDate` also drives
   *   the FX conversion.
   * @returns A {@link Result} wrapping the
   *   {@link PortfolioCalculationServiceReturn} (updated portfolio plus
   *   per-bond and portfolio {@link EngineSummary}s), or a failure when
   *   conversion fails or no portfolio formula could be computed.
   */
  static async calculate(
    portfolio: Portfolio,
    marketDataStore: MarketDataStore,
    options: BondFormulaOptions
  ): Promise<Result<PortfolioCalculationServiceReturn>> {
    // 1. Convert all bonds to portfolio base currency
    const convertedResult = PortfolioCurrencyConverter.convert(
      portfolio,
      portfolio.props.baseCurrency,
      marketDataStore,
      options.settlementDate
    );
    if (!convertedResult.success) {
      return ResultHelper.addContext(
        convertedResult,
        "Portfolio Calculation Service"
      );
    }
    portfolio = convertedResult.value;

    // 2. Ensure all bonds have metrics
    const metricsResult = await this.ensureBondMetrics(
      portfolio,
      marketDataStore,
      options
    );
    if (!metricsResult.success) {
      return ResultHelper.addContext(
        metricsResult,
        "Portfolio Calculation Service"
      );
    }
    const { portfolio: preparedPortfolio, bondCalculationSummaries } =
      metricsResult.value;

    // 3. Calculate portfolio-level metrics
    const engine = new CalculationEngine(
      preparedPortfolio,
      marketDataStore,
      options
    );
    engine.addFormulas(ALL_PORTFOLIO_FORMULAS);
    const { results, summary } = await engine.calculateAll();

    // 4. Check for critical failures
    if (summary.successful === 0 && summary.failed > 0) {
      const errorMessages = Array.from(summary.failureReasons.entries())
        .map(([id, reason]) => `${id}: ${reason}`)
        .join("; ");
      return ResultHelper.failure(
        `All portfolio calculations failed: ${errorMessages}`
      );
    }

    // 5. Build and attach metrics
    const portfolioMetricsResult = this.buildMetrics(
      preparedPortfolio,
      marketDataStore,
      results
    );
    if (!portfolioMetricsResult.success) {
      return ResultHelper.addContext(
        portfolioMetricsResult,
        "Portfolio Calculation Service"
      );
    }
    const metrics = portfolioMetricsResult.value;
    const updatedPortfolio = preparedPortfolio.update({ metrics });

    return ResultHelper.success({
      updatedPortfolio,
      bondCalculationSummaries,
      portfolioCalculationSummary: summary,
    });
  }

  private static async ensureBondMetrics(
    portfolio: Portfolio,
    marketDataStore: MarketDataStore,
    options: BondFormulaOptions
  ): Promise<
    Result<{
      portfolio: Portfolio;
      bondCalculationSummaries: {
        bondId: BondId;
        engineSummary: EngineSummary;
      }[];
    }>
  > {
    // Trigger all bond calculations concurrently
    const calculations = portfolio.props.positions.map(async (position) => {
      const bond = position.bond;

      // Skip if metrics already exist
      if (bond.props.metrics) {
        return {
          success: true as const,
          position,
          summary: null,
        };
      }

      // Calculate metrics
      const calcResult = await BondCalculationService.calculate(
        bond,
        marketDataStore,
        options
      );

      if (!calcResult.success) {
        return {
          success: false as const,
          error: calcResult.error,
          bondId: bond.props.id.primary,
        };
      }

      return {
        success: true as const,
        position: { ...position, bond: calcResult.value.updatedBond },
        summary: {
          bondId: calcResult.value.updatedBond.props.id,
          engineSummary: calcResult.value.calculationSummary,
        },
      };
    });

    // Wait for all calculations to complete
    const results = await Promise.all(calculations);

    // Check for failures
    const failure = results.find((r) => !r.success);
    if (failure && !failure.success) {
      return ResultHelper.failure(
        `Failed to ensure metrics for bond ${failure.bondId}: ${failure.error}`
      );
    }

    // Extract successful results (all are successful at this point)
    const updatedPositions = results
      .filter((r): r is Extract<typeof r, { success: true }> => r.success)
      .map((r) => r.position);

    const bondCalculationSummaries = results
      .filter((r): r is Extract<typeof r, { success: true }> => r.success)
      .map((r) => r.summary)
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return ResultHelper.success({
      portfolio: portfolio.update({ positions: updatedPositions }),
      bondCalculationSummaries,
    });
  }

  private static buildMetrics(
    portfolio: Portfolio,
    marketDataStore: MarketDataStore,
    results: Map<string, Result<any>>
  ): Result<PortfolioMetrics> {
    let calculationDate: UTCDate;
    const marketDataResult = marketDataStore.getLatest();
    if (marketDataResult.success) {
      calculationDate = marketDataResult.value.asOfDate;
    } else {
      const todayResult = UTCDate.today();
      if (!todayResult.success) {
        // This should never fail, but handle it
        return ResultHelper.failure("Failed to get calculation date");
      }
      calculationDate = todayResult.value;
    }

    const metrics: PortfolioMetrics = {
      portfolioId: portfolio.props.id,
      calculationDate,
      numberOfPositions: portfolio.props.positions.length,
    };

    // Map formula results to metrics (formula IDs match property names)
    for (const [formulaId, result] of results.entries()) {
      if (result.success) {
        (metrics as Record<string, any>)[formulaId] = result.value;
      }
    }

    return ResultHelper.success(metrics);
  }
}
