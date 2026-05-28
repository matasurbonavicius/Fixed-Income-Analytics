import { BondFormula } from "../BondFormula";
import { Result, ResultHelper } from "@domain/shared";
import { CalculationEngine } from "@application/core";
import { Money, Percentage, UTCDate } from "@domain/valueObjects";
import * as entities from "@domain/entities";
import * as formulas from "@domain/formulas";

export class CashFlowsFormula extends BondFormula<formulas.CashFlowSchedule> {
  constructor() {
    super("cashFlows");
  }

  async execute(
    engine: CalculationEngine
  ): Promise<Result<formulas.CashFlowSchedule>> {
    const bond = engine.getEntityData() as entities.Bond;
    const bondType = bond.props.bondType;
    const options = engine.getOptions().cashFlow;

    // Get settlement date
    const settlementDateResult = this.getSettlementDate(engine, bond.props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(
        settlementDateResult,
        "Cash Flows Formula"
      );
    }
    const settlementDate = settlementDateResult.value;

    // Get market price if requested
    let dirtyPrice: Money | undefined;
    if (options?.includeInitialOutflow) {
      const dirtyPricePercentResult = await this.getDependency<Percentage>(
        engine,
        "dirtyPrice"
      );
      if (!dirtyPricePercentResult.success) {
        return ResultHelper.addContext(dirtyPricePercentResult, "Cash Flows Formula");
      }

      // Convert dirty price percentage to Money
      const dirtyPriceMoneyResult = bond.props.faceValue.multiplyByPercentage(dirtyPricePercentResult.value);
      if (!dirtyPriceMoneyResult.success) {
        return ResultHelper.addContext(dirtyPriceMoneyResult, "Cash Flows Formula");
      }
      dirtyPrice = dirtyPriceMoneyResult.value;
    }

    if (bondType === "ZERO") {
      return this.executeForZero(bond, dirtyPrice, settlementDate);
    }

    if (bondType === "FIXED") {
      return this.executeForFixed(bond, dirtyPrice, settlementDate);
    }

    return ResultHelper.failure(`Unsupported bond type: ${bondType}`);
  }

  private async executeForZero(
    bond: entities.Bond,
    dirtyPrice: Money | undefined,
    settlementDate: UTCDate
  ): Promise<Result<formulas.CashFlowSchedule>> {
    const props = bond.props as entities.ZeroCouponBondProps;

    const calcInput: formulas.CashFlowZeroInput = {
      bondId: bond.props.id.primary,
      faceValue: props.faceValue!,
      currency: props.issueCurrency,
      settlementDate: settlementDate,
      maturityDate: props.maturityDate!,
      dirtyPrice: dirtyPrice,
    };

    const calcValidation = formulas.validateCashFlowZero(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(calcValidation, "Cash Flows Formula");
    }

    const cashFlows = formulas.generateCashFlowsZero(calcInput);
    if (!cashFlows.success) {
      return ResultHelper.addContext(cashFlows, "Cash Flows Formula");
    }

    return cashFlows;
  }

  private async executeForFixed(
    bond: entities.Bond,
    dirtyPrice: Money | undefined,
    settlementDate: UTCDate
  ): Promise<Result<formulas.CashFlowSchedule>> {
    const props = bond.props as entities.FixedRateBondProps;

    const scheduleResult = formulas.generateCouponSchedule({
      issueDate: props.issueDate,
      maturityDate: props.maturityDate!,
      firstCouponDate: props.firstCouponDate,
      frequency: props.frequency!,
      businessDayConvention: props.businessDayConvention,
      calendar: props.paymentCalendar,
    });
    if (!scheduleResult.success) {
      return ResultHelper.addContext(scheduleResult, "Cash Flows Formula");
    }
    const schedule = scheduleResult.value;

    const futureCoupons = formulas.getFutureCoupons(schedule, settlementDate);

    // === STEP 5: Generate cash flows ===
    return formulas.generateCashFlowsFixed({
      bondId: bond.props.id.primary,
      faceValue: props.faceValue!,
      fixedRate: props.fixedRate!,
      frequency: props.frequency!,
      currency: props.issueCurrency,
      settlementDate: settlementDate,
      maturityDate: props.maturityDate!,
      futureCoupons,
      dayCountConvention: props.dayCountConvention,
      dirtyPrice,
    });
  }
}
