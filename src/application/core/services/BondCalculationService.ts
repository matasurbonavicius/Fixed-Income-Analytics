import { Bond, BondMetrics } from "@domain/entities";
import { MarketDataStore } from "@domain/dataStructures";
import { CalculationEngine, EngineSummary } from "../CalculationEngine";
import { Result, ResultHelper } from "@domain/shared";
import { BondFormulaOptions } from "@domain/specifications";
import { ALL_BOND_FORMULAS } from "@application/formulas";
import { UTCDate } from "@domain/valueObjects";

/**
 * The successful outcome of {@link BondCalculationService.calculate}.
 *
 * @category Results & Types
 */
export interface BondCalculationServiceReturn {
  /**
   * A new {@link Bond} carrying the computed `metrics`. The input bond is
   * never mutated - this is a fresh value with the metrics attached.
   */
  updatedBond: Bond;
  /**
   * Counts, timing and per-formula failure reasons for the run. Inspect this
   * even on success: a run can succeed overall while individual metrics fail.
   */
  calculationSummary: EngineSummary;
}

/**
 * Optional caller context threaded through a calculation request.
 *
 * @remarks
 * Reserved for attributing a run to a caller (audit logging, multi-tenant
 * tracing). It does not affect the numbers produced.
 *
 * @category Results & Types
 */
export interface CalculationContext {
  /** Identifier of the user or actor initiating the calculation. */
  userId?: string;
}

/**
 * Computes the full set of analytics for a single {@link Bond}.
 *
 * This is the primary entry point most callers use. It hides the
 * {@link CalculationEngine} wiring: it constructs an engine for the bond and
 * market-data snapshot, registers every formula in {@link ALL_BOND_FORMULAS},
 * runs them, and maps each successful formula result onto a `BondMetrics`
 * object (formula ids are chosen to match metric property names, so the
 * mapping is a direct key copy). The result is a new {@link Bond} carrying
 * those metrics plus an {@link EngineSummary} describing the run.
 *
 * @example
 * ```ts
 * const result = await BondCalculationService.calculate(bond, store, options);
 * if (!result.success) throw new Error(result.error);
 * const { updatedBond, calculationSummary } = result.value;
 * console.log(updatedBond.props.metrics);
 * ```
 *
 * @remarks
 * This is the Quickstart pattern - reach for {@link CalculationEngine}
 * directly only when you need a custom formula set. For many bonds use
 * {@link BondsCalculationService}; for portfolio-level aggregation use
 * {@link PortfolioCalculationService}.
 *
 * @category Services
 */
export class BondCalculationService {
  /**
   * Runs all bond formulas and returns a metrics-laden copy of the bond.
   *
   * Never throws and never mutates `bond`: expected failures (bad input,
   * missing market data) surface as a failure {@link Result}. A run fails
   * outright only when *every* formula fails; if at least one succeeds the
   * call returns success and the per-formula failures are recorded in
   * {@link EngineSummary.failureReasons}. Successful formula values are copied
   * onto the bond's metrics by matching formula id to metric property name.
   *
   * @param bond - The {@link Bond} to value. Read-only; left unmodified.
   * @param marketDataStore - Prices, curves, spreads and FX rates the formulas
   *   read from, indexed by as-of date.
   * @param options - Settlement/analysis dates and discount-rate and cash-flow
   *   settings driving the calculation (see {@link BondFormulaOptions}).
   * @returns A {@link Result} wrapping the {@link BondCalculationServiceReturn}
   *   (updated bond plus {@link EngineSummary}), or a failure when no formula
   *   could be computed.
   */
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
