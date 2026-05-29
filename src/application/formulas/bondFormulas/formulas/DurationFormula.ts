import { BondFormula } from "../BondFormula";
import { Result, ResultHelper } from "@domain/shared";
import { CalculationEngine } from "@application/core";
import { Percentage, UTCDate } from "@domain/valueObjects";
import * as entities from "@domain/entities";
import * as formulas from "@domain/formulas";

/**
 * Calculates three duration metrics:
 * - Macaulay Duration: Weighted average time to receive cash flows (in years)
 * - Modified Duration: Price sensitivity to yield changes
 * - Dollar Duration: Dollar change in price for 1% yield change
 *
 * @internal
 */
export class DurationFormula extends BondFormula<formulas.DurationResult> {
  constructor() {
    super("duration");
  }

  async execute(
    engine: CalculationEngine
  ): Promise<Result<formulas.DurationResult>> {
    const bond = engine.getEntityData() as entities.Bond;
    const bondType = bond.props.bondType;

    // Get settlement date
    const settlementDateResult = this.getSettlementDate(engine, bond.props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(settlementDateResult, "Duration Formula");
    }
    const settDate = settlementDateResult.value;

    // Get discount rate
    const discountRateResult =
      await this.getDependency<formulas.DiscountRateResult>(
        engine,
        "discountRate"
      );
    if (!discountRateResult.success) {
      return ResultHelper.addContext(discountRateResult, "Duration Formula");
    }
    const discRate = discountRateResult.value.discountRate;

    // Get clean price
    const cleanPriceResult = await this.getDependency<Percentage>(
      engine,
      "cleanPrice"
    );
    if (!cleanPriceResult.success) {
      return ResultHelper.addContext(cleanPriceResult, "Duration Formula");
    }
    const cleanP = cleanPriceResult.value;

    if (bondType === "ZERO") {
      return this.executeForZero(bond.props, settDate, discRate, cleanP);
    }

    if (bondType === "FIXED") {
      return this.executeForFixed(bond.props, settDate, discRate, cleanP);
    }

    return ResultHelper.failure(`Unsupported bond type: ${bondType}`);
  }

  private async executeForZero(
    props: entities.ZeroCouponBondProps,
    settlementDate: UTCDate,
    discountRate: Percentage,
    cleanPrice: Percentage
  ): Promise<Result<formulas.DurationResult>> {
    const calcInput: formulas.MacaulayDurationZeroInput = {
      analyticalCurrency: props.analyticalCurrency,
      faceValue: props.faceValue,
      currency: props.issueCurrency,
      cleanPrice: cleanPrice,
      discountRate: discountRate,
      settlementDate,
      maturityDate: props.maturityDate,
      dayCountConvention: props.dayCountConvention,
    };

    const calcValidation = formulas.validateDurationZero(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Duration Formula");
    }

    const durationResult = formulas.calculateDurationZero(calcInput);
    if (!durationResult.success) {
      return ResultHelper.addContext(durationResult, "Duration Formula");
    }

    return durationResult;
  }

  private async executeForFixed(
    props: entities.FixedRateBondProps,
    settlementDate: UTCDate,
    discountRate: Percentage,
    cleanPrice: Percentage
  ): Promise<Result<formulas.DurationResult>> {
    const scheduleResult = formulas.generateCouponSchedule({
      issueDate: props.issueDate,
      maturityDate: props.maturityDate,
      firstCouponDate: props.firstCouponDate,
      frequency: props.frequency,
      businessDayConvention: props.businessDayConvention,
      calendar: props.paymentCalendar,
    });
    if (!scheduleResult.success) {
      return ResultHelper.addContext(
        scheduleResult,
        "Duration Formula"
      );
    }
    const schedule = scheduleResult.value;

    if (schedule.length === 0) {
      return ResultHelper.failure("Unable to generate coupon schedule");
    }

    const futureCoupons = formulas.getFutureCoupons(schedule, settlementDate);
    if (futureCoupons.length === 0) {
      return ResultHelper.failure("No future coupons remaining");
    }

    const calcInput: formulas.MacaulayDurationFixedInput = {
      faceValue: props.faceValue,
      fixedRate: props.fixedRate,
      frequency: props.frequency,
      yield: discountRate,
      currency: props.analyticalCurrency,
      cleanPrice: cleanPrice,
      settlementDate,
      maturityDate: props.maturityDate,
      futureCoupons,
      dayCountConvention: props.dayCountConvention,
      compoundingFrequency: props.frequency,
    };

    const calcValidation = formulas.validateDurationFixed(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Duration Formula");
    }

    const durationResult = formulas.calculateDurationFixed(calcInput);
    if (!durationResult.success) {
      return ResultHelper.addContext(durationResult, "Duration Formula");
    }

    return durationResult;
  }
}
