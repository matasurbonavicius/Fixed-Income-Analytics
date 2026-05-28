import { MarketDataStore } from "@domain/dataStructures";
import { Bond, Portfolio } from "@domain/entities";
import { Result, ResultHelper } from "@domain/shared";
import { BondFormula, PortfolioFormula } from "@application/formulas";
import { BondFormulaOptions } from "@domain/specifications";

export interface EngineSummary {
  successful: number;
  failed: number;
  total: number;
  totalExecutionTime: number;
  failureReasons: Map<string, string>;
}

export class CalculationEngine {
  private formulas = new Map<string, BondFormula | PortfolioFormula>();
  private cache = new Map<string, Result<any> | Promise<Result<any>>>();
  private waitingFor = new Map<string, string>(); // Tracks "formulaA is waiting for formulaB"

  constructor(
    private entityData: Bond | Portfolio,
    private marketDataStore: MarketDataStore,
    private options: BondFormulaOptions,
  ) {}

  getEntityData(): Bond | Portfolio {
    return this.entityData;
  }

  getMarketData(): MarketDataStore {
    return this.marketDataStore;
  }

  getOptions(): BondFormulaOptions {
    return this.options;
  }

  addFormulas(formulas: BondFormula[] | PortfolioFormula[]): void {
    formulas.forEach((formula) => this.formulas.set(formula.id, formula));
  }

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
   * Get result for a dependency request from a formula
   * Includes circular dependency detection
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
