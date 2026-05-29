import { BondFormula } from "../BondFormula";
import { Result, ResultHelper } from "@domain/shared";
import { CalculationEngine } from "@application/core";
import { Percentage } from "@domain/valueObjects";
import { getMarketPrice } from "@domain/dataStructures";
import * as entities from "@domain/entities";
import * as formulas from "@domain/formulas";

/** @internal */
export class CleanPriceFormula extends BondFormula<Percentage> {
  constructor() {
    super("cleanPrice");
  }

  async execute(engine: CalculationEngine): Promise<Result<Percentage>> {
    const bond = engine.getEntityData() as entities.Bond;
    const bondType = bond.props.bondType;

    // If clean price is found in market data, return immediately
    const marketDataResult = engine
      .getMarketData()
      .getByDate(engine.getOptions().analysisDate);
    if (marketDataResult.success) {
      const cleanPriceResult = getMarketPrice(
        bond,
        marketDataResult.value,
        "clean"
      );
      if (cleanPriceResult.success) {
        return cleanPriceResult;
      }
    }

    // No market clean price found, calculate from dirty price
    if (bondType === "ZERO") {
      return this.executeForZero(engine);
    }

    if (bondType === "FIXED") {
      return this.executeForFixed(engine);
    }

    return ResultHelper.failure(`Unsupported bond type: ${bondType}`);
  }

  private async executeForZero(
    engine: CalculationEngine
  ): Promise<Result<Percentage>> {
    // Get dirty price
    const dirtyPriceResult = await this.getDependency<Percentage>(
      engine,
      "dirtyPrice"
    );
    if (!dirtyPriceResult.success) {
      return ResultHelper.addContext(dirtyPriceResult, "Clean Price Formula");
    }

    const calcInput: formulas.CleanPriceZeroFromDirtyInput = {
      dirtyPrice: dirtyPriceResult.value,
    };

    const validation = formulas.validateCleanPriceZero(calcInput);
    if (!validation.success) {
      return ResultHelper.addContext(validation, "Clean Price Formula");
    }

    return formulas.calculateCleanPriceZeroFromDirty(calcInput);
  }

  private async executeForFixed(
    engine: CalculationEngine
  ): Promise<Result<Percentage>> {
    // Get dirty price
    const dirtyPriceResult = await this.getDependency<Percentage>(
      engine,
      "dirtyPrice"
    );
    if (!dirtyPriceResult.success) {
      return ResultHelper.addContext(dirtyPriceResult, "Clean Price Formula");
    }

    // Get accrued interest
    const accruedInterestResult =
      await this.getDependency<formulas.AccruedInterestResult>(
        engine,
        "accruedInterest"
      );
    if (!accruedInterestResult.success) {
      return ResultHelper.addContext(
        accruedInterestResult,
        "Clean Price Formula"
      );
    }

    const calcInput: formulas.CleanPriceFixedFromDirtyInput = {
      dirtyPrice: dirtyPriceResult.value,
      accruedInterest: accruedInterestResult.value,
    };

    const validation = formulas.validateCleanPriceFixed(calcInput);
    if (!validation.success) {
      return ResultHelper.addContext(validation, "Clean Price Formula");
    }

    return formulas.calculateCleanPriceFixedFromDirty(calcInput);
  }
}
