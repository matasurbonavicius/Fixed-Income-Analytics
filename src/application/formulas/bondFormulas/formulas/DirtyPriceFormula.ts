import { BondFormula } from "../BondFormula";
import { Result, ResultHelper } from "@domain/shared";
import { CalculationEngine } from "@application/core";
import { Percentage, DiscountCurve } from "@domain/valueObjects";
import { Bond } from "@domain/entities";
import { getMarketPrice, buildDiscountCurve } from "@domain/dataStructures";
import * as entities from "@domain/entities";
import * as formulas from "@domain/formulas";

/** @internal */
export class DirtyPriceFormula extends BondFormula<Percentage> {
  constructor() {
    super("dirtyPrice");
  }

  async execute(engine: CalculationEngine): Promise<Result<Percentage>> {
    const bond = engine.getEntityData() as Bond;
    const bondType = bond.props.bondType;

    // If dirty price is found in market data, return immediately
    const marketDataResult = engine
      .getMarketData()
      .getByDate(engine.getOptions().analysisDate);
    if (marketDataResult.success) {
      const marketDirtyPriceResult = getMarketPrice(
        bond,
        marketDataResult.value,
        "dirty"
      );
      if (marketDirtyPriceResult.success) {
        return ResultHelper.success(marketDirtyPriceResult.value);
      }

      // Check if clean price exists in market data
      const marketCleanPriceResult = getMarketPrice(
        bond,
        marketDataResult.value,
        "clean"
      );
      if (marketCleanPriceResult.success) {
        // Calculate dirty from clean price
        if (bondType === "ZERO") {
          // For zero coupon: dirty = clean (no accrued interest)
          return ResultHelper.success(marketCleanPriceResult.value);
        }
        if (bondType === "FIXED") {
          // For fixed: dirty = clean + accrued
          return this.executeForFixedFromClean(engine, marketCleanPriceResult.value);
        }
      }
    }

    // No market prices found, calculate it. In "curve" pricing mode discount
    // each flow off the snapshot's yield curve; otherwise use the flat yield.
    const curveMode = engine.getOptions().pricingMode === "curve";

    if (bondType === "ZERO") {
      return curveMode
        ? this.executeForZeroFromCurve(engine, bond)
        : this.executeForZero(engine, bond);
    }

    if (bondType === "FIXED") {
      return curveMode
        ? this.executeForFixedFromCurve(engine, bond)
        : this.executeForFixed(engine, bond);
    }

    return ResultHelper.failure(`Unsupported bond type: ${bondType}`);
  }

  /** Build the discount curve for the bond's analytical currency. */
  private buildCurve(
    engine: CalculationEngine,
    props: entities.ZeroCouponBondProps | entities.FixedRateBondProps
  ): Result<DiscountCurve> {
    const marketDataResult = engine
      .getMarketData()
      .getByDate(engine.getOptions().analysisDate);
    if (!marketDataResult.success) {
      return ResultHelper.addContext(marketDataResult, "Dirty Price Formula");
    }

    return buildDiscountCurve(marketDataResult.value, props.analyticalCurrency);
  }

  private async executeForZeroFromCurve(
    engine: CalculationEngine,
    bond: entities.Bond
  ): Promise<Result<Percentage>> {
    const props = bond.props as entities.ZeroCouponBondProps;

    const settlementDateResult = this.getSettlementDate(engine, bond.props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(settlementDateResult, "Dirty Price Formula");
    }

    const curveResult = this.buildCurve(engine, props);
    if (!curveResult.success) {
      return curveResult;
    }

    const calcInput: formulas.DirtyPriceZeroFromCurveInput = {
      settlementDate: settlementDateResult.value,
      maturityDate: props.maturityDate,
      curve: curveResult.value,
      dayCountConvention: props.dayCountConvention,
    };

    const calcValidation = formulas.validateDirtyPriceZeroFromCurve(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Dirty Price Formula");
    }

    const dirtyPriceResult = formulas.calculateDirtyPriceZeroFromCurve(calcInput);
    if (!dirtyPriceResult.success) {
      return ResultHelper.addContext(dirtyPriceResult, "Dirty Price Formula");
    }

    return dirtyPriceResult;
  }

  private async executeForFixedFromCurve(
    engine: CalculationEngine,
    bond: entities.Bond
  ): Promise<Result<Percentage>> {
    const props = bond.props as entities.FixedRateBondProps;

    const settlementDateResult = this.getSettlementDate(engine, bond.props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(settlementDateResult, "Dirty Price Formula");
    }

    const curveResult = this.buildCurve(engine, props);
    if (!curveResult.success) {
      return curveResult;
    }

    const scheduleResult = formulas.generateCouponSchedule({
      issueDate: props.issueDate,
      maturityDate: props.maturityDate,
      firstCouponDate: props.firstCouponDate,
      frequency: props.frequency,
      businessDayConvention: props.businessDayConvention,
      calendar: props.paymentCalendar,
    });
    if (!scheduleResult.success) {
      return ResultHelper.addContext(scheduleResult, "Dirty Price Formula");
    }
    const schedule = scheduleResult.value;

    if (schedule.length === 0) {
      return ResultHelper.failure("Unable to generate coupon schedule");
    }

    const futureCoupons = formulas.getFutureCoupons(
      schedule,
      settlementDateResult.value
    );

    const calcInput: formulas.DirtyPriceFixedFromCurveInput = {
      fixedRate: props.fixedRate,
      frequency: props.frequency,
      settlementDate: settlementDateResult.value,
      maturityDate: props.maturityDate,
      futureCoupons,
      curve: curveResult.value,
      dayCountConvention: props.dayCountConvention,
    };

    const calcValidation = formulas.validateDirtyPriceFixedFromCurve(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Dirty Price Formula");
    }

    const dirtyPriceResult = formulas.calculateDirtyPriceFixedFromCurve(calcInput);
    if (!dirtyPriceResult.success) {
      return ResultHelper.addContext(dirtyPriceResult, "Dirty Price Formula");
    }

    return dirtyPriceResult;
  }

  private async executeForZero(
    engine: CalculationEngine,
    bond: entities.Bond
  ): Promise<Result<Percentage>> {
    const props = bond.props as entities.ZeroCouponBondProps;

    // Calculate from yield
    const settlementDateResult = this.getSettlementDate(engine, bond.props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(
        settlementDateResult,
        "Dirty Price Formula"
      );
    }

    const discountRateResult =
      await this.getDependency<formulas.DiscountRateResult>(
        engine,
        "discountRate"
      );
    if (!discountRateResult.success) {
      return ResultHelper.addContext(discountRateResult, "Dirty Price Formula");
    }

    const calcInput: formulas.DirtyPriceZeroFromYieldInput = {
      faceValue: props.faceValue,
      currency: props.analyticalCurrency,
      settlementDate: settlementDateResult.value,
      maturityDate: props.maturityDate,
      discountRate: discountRateResult.value.discountRate,
      dayCountConvention: props.dayCountConvention,
      compoundingFrequency: 1,
    };

    const calcValidation = formulas.validateDirtyPriceZero(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Dirty Price Formula");
    }

    const dirtyPriceResult =
      formulas.calculateDirtyPriceZeroFromYield(calcInput);
    if (!dirtyPriceResult.success) {
      return ResultHelper.addContext(dirtyPriceResult, "Dirty Price Formula");
    }

    return dirtyPriceResult;
  }

  private async executeForFixed(
    engine: CalculationEngine,
    bond: entities.Bond
  ): Promise<Result<Percentage>> {
    const props = bond.props as entities.FixedRateBondProps;

    // Calculate from yield
    const settlementDateResult = this.getSettlementDate(engine, bond.props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(
        settlementDateResult,
        "Dirty Price Formula"
      );
    }

    const discountRateResult =
      await this.getDependency<formulas.DiscountRateResult>(
        engine,
        "discountRate"
      );
    if (!discountRateResult.success) {
      return ResultHelper.addContext(discountRateResult, "Dirty Price Formula");
    }

    const scheduleResult = formulas.generateCouponSchedule({
      issueDate: props.issueDate,
      maturityDate: props.maturityDate,
      firstCouponDate: props.firstCouponDate,
      frequency: props.frequency,
      businessDayConvention: props.businessDayConvention,
      calendar: props.paymentCalendar,
    });
    if (!scheduleResult.success) {
      return ResultHelper.addContext(scheduleResult, "Dirty Price Formula");
    }
    const schedule = scheduleResult.value;

    if (schedule.length === 0) {
      return ResultHelper.failure("Unable to generate coupon schedule");
    }

    const futureCoupons = formulas.getFutureCoupons(
      schedule,
      settlementDateResult.value
    );

    const calcInput: formulas.DirtyPriceFixedFromYieldInput = {
      faceValue: props.faceValue,
      fixedRate: props.fixedRate,
      frequency: props.frequency,
      currency: props.analyticalCurrency,
      settlementDate: settlementDateResult.value,
      maturityDate: props.maturityDate,
      futureCoupons,
      discountRate: discountRateResult.value.discountRate,
      dayCountConvention: props.dayCountConvention,
      compoundingFrequency: props.frequency,
    };

    const calcValidation = formulas.validateDirtyPriceFixed(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Dirty Price Formula");
    }

    const dirtyPriceResult =
      formulas.calculateDirtyPriceFixedFromYield(calcInput);
    if (!dirtyPriceResult.success) {
      return ResultHelper.addContext(dirtyPriceResult, "Dirty Price Formula");
    }

    return dirtyPriceResult;
  }

  private async executeForFixedFromClean(
    engine: CalculationEngine,
    cleanPrice: Percentage
  ): Promise<Result<Percentage>> {
    // Get accrued interest
    const accruedInterestResult =
      await this.getDependency<formulas.AccruedInterestResult>(
        engine,
        "accruedInterest"
      );
    if (!accruedInterestResult.success) {
      return ResultHelper.addContext(
        accruedInterestResult,
        "Dirty Price Formula"
      );
    }

    // Dirty Price = Clean Price + Accrued Interest
    return cleanPrice.add(accruedInterestResult.value.amountPercent);
  }
}
