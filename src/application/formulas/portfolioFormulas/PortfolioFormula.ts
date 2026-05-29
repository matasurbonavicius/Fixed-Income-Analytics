import { Result } from "@domain/shared";
import { CalculationEngine } from "@application/core";

/** @internal */
export abstract class PortfolioFormula<TResult = any> {
  constructor(
    public readonly id: string
  ) {}

  abstract execute(engine: CalculationEngine): Promise<Result<TResult>>;

  protected async getDependency<T>(
    engine: CalculationEngine,
    formulaId: string
  ): Promise<Result<T>> {
    // Use getResultForDependency to enable circular dependency detection
    return await engine.getResultForDependency<T>(formulaId, this.id);
  }
}