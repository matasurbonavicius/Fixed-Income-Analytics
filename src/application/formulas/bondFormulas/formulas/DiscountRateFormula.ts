import { BondFormula } from "../BondFormula";
import { Result, ResultHelper } from "@domain/shared";
import { CalculationEngine } from "@application/core";
import { Percentage } from "@domain/valueObjects";
import * as entities from "@domain/entities";
import * as data from "@domain/dataStructures";
import * as formulas from "@domain/formulas";
import { getMarketPrice } from "@domain/dataStructures";

/**
 * Determines the discount rate for a bond using a waterfall of methods:
 * 1. implied_from_price - Calculated from clean price (Newton-Raphson for fixed, analytical for zero)
 * 2. official_rating - Credit rating spread + yield curve
 * 3. internal_rating - Internal rating spread + yield curve
 * 4. manual_spread - Manual spread + yield curve
 * 5. manual_rate - Direct discount rate input
 *
 * @internal
 */
export class DiscountRateFormula extends BondFormula<formulas.DiscountRateResult> {
  constructor() {
    super("discountRate");
  }

  async execute(
    engine: CalculationEngine
  ): Promise<Result<formulas.DiscountRateResult>> {
    const bond = engine.getEntityData() as entities.Bond;
    const bondType = bond.props.bondType;
    const options = engine.getOptions().discountRate;
    const methods = options?.methods ?? formulas.DEFAULT_DISCOUNT_RATE_METHODS;

    if (bondType === "ZERO") {
      return this.executeForZero(bond, methods, engine);
    }

    if (bondType === "FIXED") {
      return this.executeForFixed(bond, methods, engine);
    }

    return ResultHelper.failure(`Unsupported bond type: ${bondType}`);
  }

  private async executeForZero(
    bond: entities.Bond,
    methods: entities.DiscountRateMethod[],
    engine: CalculationEngine
  ): Promise<Result<formulas.DiscountRateResult>> {
    const props = bond.props as entities.ZeroCouponBondProps;

    for (const method of methods) {
      const result = await this.tryMethod(method, "zero", props, engine);
      if (result.success) {
        return result;
      }
    }

    return ResultHelper.failure(
      `All discount rate methods failed for bond "${props.id.primary}"`
    );
  }

  private async executeForFixed(
    bond: entities.Bond,
    methods: entities.DiscountRateMethod[],
    engine: CalculationEngine
  ): Promise<Result<formulas.DiscountRateResult>> {
    const props = bond.props as entities.FixedRateBondProps;

    for (const method of methods) {
      const result = await this.tryMethod(method, "fixed", props, engine);
      if (result.success) {
        return result;
      }
    }

    return ResultHelper.failure(
      `All discount rate methods failed for bond "${props.id.primary}"`
    );
  }

  private async tryMethod(
    method: entities.DiscountRateMethod,
    type: "zero" | "fixed",
    props: entities.ZeroCouponBondProps | entities.FixedRateBondProps,
    engine: CalculationEngine
  ): Promise<Result<formulas.DiscountRateResult>> {
    switch (method) {
      case "implied_from_price": {
        // Check if market price exists - if not, skip this method
        const bond = engine.getEntityData() as entities.Bond;
        const marketDataResult = engine
          .getMarketData()
          .getByDate(engine.getOptions().analysisDate);
        if (!marketDataResult.success) {
          return ResultHelper.failure("No market data available for implied_from_price");
        }
        const dirtyPriceResult = getMarketPrice(bond, marketDataResult.value, "dirty");
        const cleanPriceResult = getMarketPrice(bond, marketDataResult.value, "clean");
        if (!dirtyPriceResult.success && !cleanPriceResult.success) {
          return ResultHelper.failure("No market price available for implied_from_price");
        }

        if (type === "zero") {
          return this.tryImpliedFromPriceZero(
            props as entities.ZeroCouponBondProps,
            engine
          );
        } else if (type === "fixed") {
          return this.tryImpliedFromPriceFixed(
            props as entities.FixedRateBondProps,
            engine
          );
        }
        return ResultHelper.failure(
          `Unsupported bond type for implied_from_price: ${type}`
        );
      }

      case "official_rating":
      case "internal_rating":
      case "manual_spread":
        return this.tryYieldCurveMethod(
          method,
          props,
          engine
        );

      case "manual_rate":
        return this.tryManualRate(props);

      default:
        return ResultHelper.failure(`Unknown method: ${method}`);
    }
  }

  private async tryImpliedFromPriceZero(
    props: entities.ZeroCouponBondProps,
    engine: CalculationEngine
  ): Promise<Result<formulas.DiscountRateResult>> {
    // Get settlement date
    const settlementDateResult = this.getSettlementDate(engine, props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(
        settlementDateResult,
        "Discount Rate Formula"
      );
    }
    const settlementDate = settlementDateResult.value;

    // Get dirty price from dependency
    const dirtyPriceResult = await this.getDependency<Percentage>(
      engine,
      "dirtyPrice"
    );
    if (!dirtyPriceResult.success) {
      return ResultHelper.addContext(dirtyPriceResult, "Discount Rate Formula");
    }

    const calcInput: formulas.ImpliedRateZeroInput = {
      faceValue: props.faceValue,
      cleanPrice: dirtyPriceResult.value,
      settlementDate: settlementDate,
      maturityDate: props.maturityDate,
      dayCountConvention: props.dayCountConvention,
    };

    const calcValidation = formulas.validateImpliedRateZero(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Discount Rate Formula");
    }

    const rateResult = formulas.calculateImpliedRateZero(calcInput);
    if (!rateResult.success) {
      return ResultHelper.addContext(rateResult, "Discount Rate Formula");
    }

    return ResultHelper.success({
      discountRate: rateResult.value,
      methodUsed: "implied_from_price",
    });
  }

  private async tryImpliedFromPriceFixed(
    props: entities.FixedRateBondProps,
    engine: CalculationEngine
  ): Promise<Result<formulas.DiscountRateResult>> {
    // Get settlement date
    const settlementDateResult = this.getSettlementDate(engine, props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(
        settlementDateResult,
        "Discount Rate Formula"
      );
    }
    const settlementDate = settlementDateResult.value;

    // Get dirty price from dependency
    const dirtyPriceResult = await this.getDependency<Percentage>(
      engine,
      "dirtyPrice"
    );
    if (!dirtyPriceResult.success) {
      return ResultHelper.addContext(dirtyPriceResult, "Discount Rate Formula");
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
      return ResultHelper.addContext(scheduleResult, "Discount Rate Formula");
    }
    const schedule = scheduleResult.value;

    const futureCoupons = formulas.getFutureCoupons(schedule, settlementDate);
    if (futureCoupons.length === 0) {
      return ResultHelper.failure("No future coupons remaining");
    }

    const calcInput: formulas.ImpliedRateFixedInput = {
      faceValue: props.faceValue,
      cleanPrice: dirtyPriceResult.value,
      fixedRate: props.fixedRate,
      frequency: props.frequency,
      settlementDate: settlementDate,
      maturityDate: props.maturityDate,
      futureCoupons: futureCoupons,
      dayCountConvention: props.dayCountConvention,
    };

    const calcValidation = formulas.validateImpliedRateFixed(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Discount Rate Formula");
    }

    const rateResult = formulas.calculateImpliedRateFixed(calcInput);
    if (!rateResult.success) {
      return ResultHelper.addContext(rateResult, "Discount Rate Formula");
    }

    return ResultHelper.success({
      discountRate: rateResult.value,
      methodUsed: "implied_from_price",
    });
  }

  // Yield curve based methods: base rate + spread
  private tryYieldCurveMethod(
    method: "official_rating" | "internal_rating" | "manual_spread",
    props: entities.ZeroCouponBondProps | entities.FixedRateBondProps,
    engine: CalculationEngine
  ): Result<formulas.DiscountRateResult> {
    // Get market data
    const marketDataResult = engine
      .getMarketData()
      .getByDate(engine.getOptions().analysisDate);
    if (!marketDataResult.success) {
      return ResultHelper.addContext(marketDataResult, "Discount Rate Formula");
    }
    const marketData = marketDataResult.value;

    // Get settlement date
    const settlementDateResult = this.getSettlementDate(engine, props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(
        settlementDateResult,
        "Discount Rate Formula"
      );
    }
    const settlementDate = settlementDateResult.value;

    const currency = props.analyticalCurrency;

    const yearsToMaturity = formulas.dayCountFraction(
      settlementDate,
      props.maturityDate,
      props.dayCountConvention
    );

    const curveResult = data.getYieldCurve(marketData, currency);
    if (!curveResult.success) {
      return ResultHelper.addContext(curveResult, "Discount Rate Formula");
    }

    const baseRateResult = data.interpolateYieldCurve(
      curveResult.value,
      yearsToMaturity
    );
    if (!baseRateResult.success) {
      return ResultHelper.addContext(baseRateResult, "Discount Rate Formula");
    }

    const spreadResult = this.getSpreadForMethod(method, props, marketData);
    if (!spreadResult.success) {
      return ResultHelper.addContext(spreadResult, "Discount Rate Formula");
    }

    // Combine: discount rate = base rate + spread
    const percentageResult = Percentage.fromDecimal(
      baseRateResult.value + spreadResult.value
    );
    if (!percentageResult.success) {
      return ResultHelper.addContext(percentageResult, "Discount Rate Formula");
    }

    return ResultHelper.success({
      discountRate: percentageResult.value,
      methodUsed: method,
    });
  }

  private getSpreadForMethod(
    method: "official_rating" | "internal_rating" | "manual_spread",
    props: entities.ZeroCouponBondProps | entities.FixedRateBondProps,
    marketData: data.MarketData
  ): Result<number> {
    switch (method) {
      case "official_rating": {
        if (!props.creditRating) {
          return ResultHelper.failure("Bond has no credit rating");
        }
        const currency = props.analyticalCurrency;
        return data.getCreditSpread(marketData, props.creditRating, currency);
      }

      case "internal_rating": {
        if (!props.internalRatingId) {
          return ResultHelper.failure("Bond has no internal rating");
        }
        const ratingResult = data.getInternalRatingSpread(
          marketData,
          props.internalRatingId
        );
        if (!ratingResult.success) {
          return ratingResult;
        }
        return ResultHelper.success(ratingResult.value.spreadBps / 10000);
      }

      case "manual_spread": {
        if (props.manualSpreadBps === undefined) {
          return ResultHelper.failure("Bond has no manual spread");
        }
        return ResultHelper.success(props.manualSpreadBps / 10000);
      }
    }
  }

  private tryManualRate(
    props: entities.ZeroCouponBondProps | entities.FixedRateBondProps
  ): Result<formulas.DiscountRateResult> {
    if (props.manualDiscountRate === undefined) {
      return ResultHelper.failure("Bond has no manual discount rate");
    }

    return ResultHelper.success({
      discountRate: props.manualDiscountRate,
      methodUsed: "manual_rate",
    });
  }
}
