// application/formulas/Formula.ts

import { Result } from "@domain/shared";
import { CalculationEngine } from "@application/core";
import * as entities from "@domain/entities";
import * as formulas from "@domain/formulas";
import { UTCDate } from "@domain/valueObjects";

/**
 * Abstract base class for all formulas
 * Provides contract and common utilities
 * Each formula implements its own orchestration in execute()
 *
 * @internal
 */
export abstract class BondFormula<TResult = any> {
  constructor(
    public readonly id: string
  ) {}

  abstract execute(engine: CalculationEngine): Promise<Result<TResult>>;

  // Get dependency as:
  // await this.getDependency<formulasDomain.DiscountRateResult>(
  //    engine,
  //    "discountRate"
  // );
  protected async getDependency<T>(
    engine: CalculationEngine,
    formulaId: string
  ): Promise<Result<T>> {
    // Use getResultForDependency to enable circular dependency detection
    return await engine.getResultForDependency<T>(formulaId, this.id);
  }

  // Get settlement date as:
  // const settlementDateResult = this.getSettlementDate(engine, bond);
  // if (!settlementDateResult.success) {
  //     return ResultHelper.addContext(settlementDateResult, "CleanPriceFormula");
  // }
  protected getSettlementDate(
    engine: CalculationEngine,
    props: entities.ZeroCouponBondProps | entities.FixedRateBondProps
  ): Result<UTCDate> {

    return formulas.adjustSettlement(
      engine.getOptions().settlementDate,
      props.issueDate,
      props.maturityDate,
      props.settlementDays,
      props.paymentCalendar
    );
  }
}
