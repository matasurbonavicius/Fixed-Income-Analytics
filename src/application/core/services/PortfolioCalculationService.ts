import { Portfolio, PortfolioMetrics } from "@domain/entities";
import { MarketDataStore } from "@domain/dataStructures";
import { CalculationEngine, EngineSummary } from "../CalculationEngine";
import { Result, ResultHelper } from "@domain/shared";
import { BondFormulaOptions } from "@domain/specifications";
import { BondId, UTCDate } from "@domain/valueObjects";
import { ALL_PORTFOLIO_FORMULAS } from "@application/formulas";
import { PortfolioCurrencyConverter } from "../utils";
import { BondCalculationService } from "./BondCalculationService";

export interface PortfolioCalculationServiceReturn {
  updatedPortfolio: Portfolio;
  bondCalculationSummaries: { bondId: BondId; engineSummary: EngineSummary }[];
  portfolioCalculationSummary: EngineSummary;
}

export class PortfolioCalculationService {
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
