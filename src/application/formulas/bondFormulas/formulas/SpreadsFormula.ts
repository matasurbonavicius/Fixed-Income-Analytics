import { BondFormula } from "../BondFormula";
import { Result, ResultHelper } from "@domain/shared";
import { CalculationEngine } from "@application/core";
import { Percentage, UTCDate, DiscountCurve } from "@domain/valueObjects";
import { buildDiscountCurve } from "@domain/dataStructures";
import * as entities from "@domain/entities";
import * as formulas from "@domain/formulas";

/**
 * Calculates the bond's curve-relative spreads:
 * - Z-spread: the constant add-on to every zero rate of the currency's yield
 *   curve that reprices the bond to its observed dirty price (the headline).
 * - I-spread: bond yield minus the curve's zero rate at the bond's remaining
 *   life.
 * - G-spread: the same against a government curve, when one is available.
 *
 * Depends on `dirtyPrice` (the market price to match) and `discountRate` (the
 * bond yield, for I/G-spread). Requires a yield curve for the bond's
 * analytical currency in the market-data snapshot.
 *
 * @internal
 */
export class SpreadsFormula extends BondFormula<formulas.SpreadsResult> {
  constructor() {
    super("spreads");
  }

  async execute(
    engine: CalculationEngine
  ): Promise<Result<formulas.SpreadsResult>> {
    const bond = engine.getEntityData() as entities.Bond;
    const bondType = bond.props.bondType;

    const settlementDateResult = this.getSettlementDate(engine, bond.props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(settlementDateResult, "Spreads Formula");
    }
    const settlementDate = settlementDateResult.value;

    // Dirty price to reprice against.
    const dirtyPriceResult = await this.getDependency<Percentage>(
      engine,
      "dirtyPrice"
    );
    if (!dirtyPriceResult.success) {
      return ResultHelper.addContext(dirtyPriceResult, "Spreads Formula");
    }
    const dirtyPrice = dirtyPriceResult.value;

    // Bond yield (for I/G-spread).
    const discountRateResult =
      await this.getDependency<formulas.DiscountRateResult>(
        engine,
        "discountRate"
      );
    if (!discountRateResult.success) {
      return ResultHelper.addContext(discountRateResult, "Spreads Formula");
    }
    const bondYield = discountRateResult.value.discountRate;

    // Build the discount curve for the bond's analytical currency.
    const curveResult = this.buildCurve(engine, bond.props);
    if (!curveResult.success) {
      return curveResult;
    }
    const curve = curveResult.value;

    if (bondType === "ZERO") {
      return this.executeForZero(
        bond.props as entities.ZeroCouponBondProps,
        settlementDate,
        dirtyPrice,
        bondYield,
        curve
      );
    }

    if (bondType === "FIXED") {
      return this.executeForFixed(
        bond.props as entities.FixedRateBondProps,
        settlementDate,
        dirtyPrice,
        bondYield,
        curve
      );
    }

    return ResultHelper.failure(`Unsupported bond type: ${bondType}`);
  }

  private buildCurve(
    engine: CalculationEngine,
    props: entities.ZeroCouponBondProps | entities.FixedRateBondProps
  ): Result<DiscountCurve> {
    const marketDataResult = engine
      .getMarketData()
      .getByDate(engine.getOptions().analysisDate);
    if (!marketDataResult.success) {
      return ResultHelper.addContext(marketDataResult, "Spreads Formula");
    }
    return buildDiscountCurve(marketDataResult.value, props.analyticalCurrency);
  }

  private buildResult(
    zSpread: Percentage,
    bondYield: Percentage,
    yearsToMaturity: number,
    curve: DiscountCurve
  ): Result<formulas.SpreadsResult> {
    const simpleResult = formulas.calculateSimpleSpreads({
      bondYield,
      yearsToMaturity,
      curve,
    });
    if (!simpleResult.success) {
      return ResultHelper.addContext(simpleResult, "Spreads Formula");
    }

    return ResultHelper.success({
      zSpread,
      iSpread: simpleResult.value.iSpread,
      gSpread: simpleResult.value.gSpread,
    });
  }

  private executeForZero(
    props: entities.ZeroCouponBondProps,
    settlementDate: UTCDate,
    dirtyPrice: Percentage,
    bondYield: Percentage,
    curve: DiscountCurve
  ): Result<formulas.SpreadsResult> {
    const calcInput: formulas.ZSpreadZeroInput = {
      dirtyPrice,
      settlementDate,
      maturityDate: props.maturityDate,
      curve,
      dayCountConvention: props.dayCountConvention,
    };

    const calcValidation = formulas.validateZSpreadZero(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Spreads Formula");
    }

    const zSpreadResult = formulas.calculateZSpreadZero(calcInput);
    if (!zSpreadResult.success) {
      return ResultHelper.addContext(zSpreadResult, "Spreads Formula");
    }

    const yearsToMaturity = formulas.dayCountFraction(
      settlementDate,
      props.maturityDate,
      props.dayCountConvention
    );

    return this.buildResult(zSpreadResult.value, bondYield, yearsToMaturity, curve);
  }

  private executeForFixed(
    props: entities.FixedRateBondProps,
    settlementDate: UTCDate,
    dirtyPrice: Percentage,
    bondYield: Percentage,
    curve: DiscountCurve
  ): Result<formulas.SpreadsResult> {
    const scheduleResult = formulas.generateCouponSchedule({
      issueDate: props.issueDate,
      maturityDate: props.maturityDate,
      firstCouponDate: props.firstCouponDate,
      frequency: props.frequency,
      businessDayConvention: props.businessDayConvention,
      calendar: props.paymentCalendar,
    });
    if (!scheduleResult.success) {
      return ResultHelper.addContext(scheduleResult, "Spreads Formula");
    }
    const schedule = scheduleResult.value;

    if (schedule.length === 0) {
      return ResultHelper.failure("Unable to generate coupon schedule");
    }

    const futureCoupons = formulas.getFutureCoupons(schedule, settlementDate);
    if (futureCoupons.length === 0) {
      return ResultHelper.failure("No future coupons remaining");
    }

    const calcInput: formulas.ZSpreadFixedInput = {
      dirtyPrice,
      fixedRate: props.fixedRate,
      frequency: props.frequency,
      settlementDate,
      maturityDate: props.maturityDate,
      futureCoupons,
      curve,
      dayCountConvention: props.dayCountConvention,
    };

    const calcValidation = formulas.validateZSpreadFixed(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Spreads Formula");
    }

    const zSpreadResult = formulas.calculateZSpreadFixed(calcInput);
    if (!zSpreadResult.success) {
      return ResultHelper.addContext(zSpreadResult, "Spreads Formula");
    }

    const yearsToMaturity = formulas.dayCountFraction(
      settlementDate,
      props.maturityDate,
      props.dayCountConvention
    );

    return this.buildResult(zSpreadResult.value, bondYield, yearsToMaturity, curve);
  }
}
