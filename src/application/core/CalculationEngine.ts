import { MarketDataStore } from "@domain/dataStructures";
import { Bond, Portfolio } from "@domain/entities";
import { Result, ResultHelper } from "@domain/shared";
import { BondFormula, PortfolioFormula } from "@application/formulas";
import { BondFormulaOptions } from "@domain/specifications";

/**
 * Outcome statistics for a single {@link CalculationEngine.calculateAll} run.
 *
 * @category Results & Types
 */
export interface EngineSummary {
  /** Number of formulas that produced a successful {@link Result}. */
  successful: number;
  /** Number of formulas that failed (bad input, missing data, or a cycle). */
  failed: number;
  /** Total formulas executed - always `successful + failed`. */
  total: number;
  /** Wall-clock time for the whole run, in milliseconds. */
  totalExecutionTime: number;
  /** Per-formula failure messages, keyed by formula id. Empty on full success. */
  failureReasons: Map<string, string>;
}

/**
 * Resolves a set of inter-dependent formulas into computed metrics.
 *
 * A bond's metrics form a dependency graph - clean price needs accrued
 * interest, duration needs both the cash flows and the discount rate, and the
 * discount rate may itself come from inverting an observed price. Rather than
 * hard-wire that ordering, the engine treats the metrics as a **directed
 * acyclic graph of formulas** and lets each formula pull its own dependencies
 * on demand via {@link getResultForDependency}.
 *
 * What the engine guarantees:
 *
 * - **Lazy, demand-driven ordering.** There is no explicit topological sort.
 *   {@link calculateAll} kicks off every formula concurrently; each one
 *   `await`s the dependencies it actually needs, so execution order falls out
 *   of the graph naturally.
 * - **Memoization within a run.** The first request for a formula caches its
 *   in-flight `Promise` (see {@link getResult}), so a dependency shared by
 *   several formulas - the cash-flow schedule, say - is computed exactly once.
 * - **Cycle detection.** {@link getResultForDependency} walks the pending
 *   dependency chain before awaiting, so a circular dependency surfaces as a
 *   `Result` failure instead of an unbounded recursion or a deadlock.
 * - **No exceptions for expected failures.** Every formula returns a
 *   {@link Result}; the engine aggregates successes and failures into an
 *   {@link EngineSummary} rather than throwing.
 *
 * The engine is single-use: construct it for one entity + market-data snapshot,
 * register formulas, call {@link calculateAll} once, then read results. The
 * input entity is never mutated.
 *
 * @example
 * ```ts
 * const engine = new CalculationEngine(bond, marketDataStore, options);
 * engine.addFormulas(ALL_BOND_FORMULAS);
 * const { results, summary } = await engine.calculateAll();
 * if (summary.failed > 0) console.warn(summary.failureReasons);
 * ```
 *
 * @remarks
 * In normal use you don't construct this directly - the calculation services
 * ({@link BondCalculationService}, {@link PortfolioCalculationService}) wire up
 * the engine and the right formula set for you. Reach for it directly only when
 * you need a custom formula set.
 *
 * @category Services
 */
export class CalculationEngine {
  private formulas = new Map<string, BondFormula | PortfolioFormula>();
  /**
   * Per-run memo. A formula id maps first to its in-flight `Promise` (so
   * concurrent requests share one computation) and then to the resolved
   * `Result` once it settles.
   */
  private cache = new Map<string, Result<any> | Promise<Result<any>>>();
  /** Tracks "formula A is currently waiting for formula B" to detect cycles. */
  private waitingFor = new Map<string, string>();

  /**
   * @param entityData - The {@link Bond} or {@link Portfolio} being valued.
   *   Read-only; the engine never mutates it.
   * @param marketDataStore - Prices, curves, spreads and FX rates the formulas
   *   read from, indexed by as-of date.
   * @param options - Run configuration: settlement/analysis dates and the
   *   discount-rate and cash-flow settings (see {@link BondFormulaOptions}).
   */
  constructor(
    private entityData: Bond | Portfolio,
    private marketDataStore: MarketDataStore,
    private options: BondFormulaOptions,
  ) {}

  /** The entity passed to the constructor. Formulas use this to read bond terms. */
  getEntityData(): Bond | Portfolio {
    return this.entityData;
  }

  /** The market-data snapshot passed to the constructor. */
  getMarketData(): MarketDataStore {
    return this.marketDataStore;
  }

  /** The run options passed to the constructor. */
  getOptions(): BondFormulaOptions {
    return this.options;
  }

  /**
   * Registers formulas to be computed on the next {@link calculateAll}.
   *
   * Formulas are keyed by their `id`, so registering one with an id that is
   * already present replaces it. Call before {@link calculateAll}.
   *
   * @param formulas - The formula adapters to run, e.g. {@link ALL_BOND_FORMULAS}.
   */
  addFormulas(formulas: BondFormula[] | PortfolioFormula[]): void {
    formulas.forEach((formula) => this.formulas.set(formula.id, formula));
  }

  /**
   * Computes every registered formula and returns their results plus a summary.
   *
   * All formulas are triggered concurrently; each awaits its own dependencies,
   * so the effective execution order is the topological order of the dependency
   * graph without an explicit sort. Shared dependencies are computed once
   * (see {@link getResult}). This method does not throw - formula failures are
   * captured in {@link EngineSummary.failureReasons}.
   *
   * @returns The per-formula {@link Result} map (keyed by formula id) and an
   *   {@link EngineSummary} with counts and total wall-clock time.
   */
  async calculateAll(): Promise<{
    results: Map<string, Result<any>>;
    summary: EngineSummary;
  }> {
    const startTime = process.hrtime.bigint();

    // 1. Trigger all calculations concurrently
    const ids = Array.from(this.formulas.keys());
    const promises = ids.map((id) => this.getResult(id));

    // 2. Wait for all to complete
    await Promise.all(promises);

    const endTime = process.hrtime.bigint();
    const totalExecutionTimeNs = Number(endTime - startTime) / 1_000_000;

    // 3. Process results and generate summary
    const { results, summary } = this.processResults();

    return {
      results,
      summary: { ...summary, totalExecutionTime: totalExecutionTimeNs },
    };
  }

  /**
   * Resolves a single formula by id, computing it if not already cached.
   *
   * The first call for a given id caches the in-flight `Promise` before
   * awaiting it, so concurrent callers requesting the same formula share one
   * computation instead of triggering duplicates. The cached `Promise` is
   * swapped for the resolved {@link Result} once it settles. A request for an
   * unregistered id resolves to a failure `Result` (it does not throw).
   *
   * @typeParam T - The value type the formula produces.
   * @param formulaId - The `id` of a registered formula.
   * @returns The formula's {@link Result}, from cache when available.
   * @see getResultForDependency for the cycle-checked variant formulas use
   *   to request *each other's* results.
   */
  async getResult<T>(formulaId: string): Promise<Result<T>> {
    // Check cache first
    const cached = this.cache.get(formulaId);

    if (cached) {
      // If it's a promise, await it. If it's a result, return it.
      return await Promise.resolve(cached);
    }

    // Check if formula exists
    const formula = this.formulas.get(formulaId);
    if (!formula) {
      const errorResult = ResultHelper.failure<T>(
        `Formula '${formulaId}' not found`,
      );
      this.cache.set(formulaId, errorResult);
      return errorResult;
    }

    // Create promise, cache it. Prevents duplicate calcs if formulas request same dependency
    const calculationPromise = this.executeFormula(formula);
    this.cache.set(formulaId, calculationPromise);

    const result = await calculationPromise;

    // Replace the promise with the actual result in cache
    this.cache.set(formulaId, result);

    return result;
  }

  /**
   * Resolves a dependency on behalf of another formula, guarding against cycles.
   *
   * This is how a formula asks the engine for a result it depends on. Before
   * awaiting, the engine walks the chain of pending "who is waiting for whom"
   * edges starting from `requestedBy`; if `formulaId` already appears in that
   * chain, the dependency is circular and a failure {@link Result} naming the
   * cycle path (e.g. `a → b → a`) is returned instead of recursing forever.
   * When no cycle is found it records the edge, delegates to
   * {@link getResult}, and clears the edge once the result settles.
   *
   * @typeParam T - The value type the depended-on formula produces.
   * @param formulaId - The dependency being requested.
   * @param requestedBy - The id of the formula making the request (the edge
   *   tail used for cycle detection).
   * @returns The dependency's {@link Result}, or a failure describing the cycle.
   */
  async getResultForDependency<T>(
    formulaId: string,
    requestedBy: string,
  ): Promise<Result<T>> {
    // Check for circular dependency by walking the dependency chain
    const chain = [requestedBy];
    let current = formulaId;

    while (current) {
      // If we've seen this formula before in the chain, we have a cycle
      if (chain.includes(current)) {
        chain.push(current);
        const cyclePath = chain.join(" → ");
        return ResultHelper.failure(
          `Circular dependency detected: ${cyclePath}`,
        );
      }

      chain.push(current);
      // Check what the current formula is waiting for
      current = this.waitingFor.get(current) || "";
    }

    // No circular dependency found - record this dependency
    this.waitingFor.set(requestedBy, formulaId);

    try {
      const result = await this.getResult<T>(formulaId);
      return result;
    } finally {
      this.waitingFor.delete(requestedBy);
    }
  }

  private async executeFormula(
    formula: BondFormula | PortfolioFormula,
  ): Promise<Result<any>> {
    // Call formula's execute method - it returns Result<T>
    const result = await formula.execute(this);
    if (!result.success) {
      return ResultHelper.addContext(result, "Calculation Engine");
    }

    return result;
  }

  private processResults(): {
    results: Map<string, Result<any>>;
    summary: {
      successful: number;
      failed: number;
      total: number;
      failureReasons: Map<string, string>;
    };
  } {
    const results = new Map<string, Result<any>>();
    let successful = 0;
    const failureReasons = new Map<string, string>();

    for (const [id, value] of this.cache.entries()) {
      const result = value as Result<any>; // it's after Promise.all, must be Result
      results.set(id, result);

      if (result.success) {
        successful++;
      } else {
        failureReasons.set(id, result.error);
      }
    }

    return {
      results,
      summary: {
        successful,
        failed: results.size - successful,
        total: results.size,
        failureReasons,
      },
    };
  }
}
