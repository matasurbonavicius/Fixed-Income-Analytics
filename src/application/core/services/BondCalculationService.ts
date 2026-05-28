import { Bond, BondMetrics } from "@domain/entities";
import { MarketDataStore } from "@domain/dataStructures";
import { CalculationEngine, EngineSummary } from "../CalculationEngine";
import { Result, ResultHelper } from "@domain/shared";
import { BondFormulaOptions } from "@domain/specifications";
import { ALL_BOND_FORMULAS } from "@application/formulas";
import { UTCDate } from "@domain/valueObjects";

export interface BondCalculationServiceReturn {
  updatedBond: Bond;
  calculationSummary: EngineSummary;
}

export interface CalculationContext {
  userId?: string;
}

export class BondCalculationService {
  static async calculate(
    bond: Bond,
    marketDataStore: MarketDataStore,
    options: BondFormulaOptions
  ): Promise<Result<BondCalculationServiceReturn>> {
    // 1. Create calculation engine
    const engine = new CalculationEngine(bond, marketDataStore, options);

    // 2. Register all formulas from registry
    engine.addFormulas(ALL_BOND_FORMULAS);

    // 3. Run all calculations
    const { results, summary } = await engine.calculateAll();

    // 4. Check for critical failures
    if (summary.successful === 0 && summary.failed > 0) {
      const errorMessages = Array.from(summary.failureReasons.entries())
        .map(([id, reason]) => `${id}: ${reason}`)
        .join("; ");

      return ResultHelper.failure(
        `All bond calculations failed: ${errorMessages}`
      );
    }

    // 5. Build metrics from results
    const metricsResult = this.buildMetrics(bond, marketDataStore, results);
    if (!metricsResult.success) {
      return metricsResult;
    }
    const metrics = metricsResult.value;

    // 6. Update bond with metrics
    const updatedBond = bond.update({ metrics });

    return ResultHelper.success({
      updatedBond,
      calculationSummary: summary,
    });
  }

  private static buildMetrics(
    bond: Bond,
    marketDataStore: MarketDataStore,
    results: Map<string, Result<any>>
  ): Result<BondMetrics> {
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

    const metrics: BondMetrics = {
      bondId: bond.props.id.primary,
      calculationDate,
    };

    // Map formula results to metrics (formula IDs match metric property names)
    for (const [formulaId, result] of results.entries()) {
      if (result.success) {
        (metrics as Record<string, any>)[formulaId] = result.value;
      }
    }

    return ResultHelper.success(metrics);
  }
}
