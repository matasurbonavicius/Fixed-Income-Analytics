import { BondFormula } from "../BondFormula";
import { Result, ResultHelper } from "@domain/shared";
import { CalculationEngine } from "@application/core";
import * as formulas from "@domain/formulas";
import * as entities from "@domain/entities";
import * as objects from "@domain/valueObjects";

/** @internal */
export class AccruedInterestFormula extends BondFormula<formulas.AccruedInterestResult> {
  constructor() {super("accruedInterest")}

  async execute(engine: CalculationEngine): Promise<Result<formulas.AccruedInterestResult>> {
    const bond = engine.getEntityData() as entities.Bond;
    const bondType = bond.props.bondType;

    // get settlement date
    const settlementDateResult = this.getSettlementDate(engine, bond.props);
    if (!settlementDateResult.success) {
      return ResultHelper.addContext(
        settlementDateResult,
        "Accrued Interest Formula"
      );
    }
    const settlementDate = settlementDateResult.value;

    if (bondType === "ZERO") {
      return this.executeForZero(bond, settlementDate);
    }

    if (bondType === "FIXED") {
      return this.executeForFixed(bond, settlementDate);
    }

    return ResultHelper.failure(`Unsupported bond type: ${bondType}`);
  }

  private executeForZero(bond: entities.Bond, settlementDate: objects.UTCDate): Result<formulas.AccruedInterestResult> {
    const props = bond.props as entities.ZeroCouponBondProps;

    const calcValidation = formulas.validateAccruedInterestZero();
    if (!calcValidation.success) {
      return ResultHelper.addContext(
        calcValidation,
        "Accrued Interest Formula"
      );
    }

    const accruedAmount = formulas.calculateAccruedInterestZero(
      props.issueCurrency,
      settlementDate
    );
    if (!accruedAmount.success) {
      return ResultHelper.addContext(accruedAmount, "Accrued Interest Formula");
    }

    return accruedAmount;
  }

  private async executeForFixed(
    bond: entities.Bond,
    settlementDate: objects.UTCDate
  ): Promise<Result<formulas.AccruedInterestResult>> {
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
      return ResultHelper.addContext(scheduleResult, "Accrued Interest Formula");
    }
    const schedule = scheduleResult.value;

    // In case fixed coupon bond has no coupons
    if (schedule.length === 0) {
      return ResultHelper.failure("Unable to generate coupon schedule");
    }

    const currentPeriod = formulas.getCurrentCouponPeriod(
      schedule,
      settlementDate
    );

    // No current period = settlement before first coupon (pre ipo) or after last (matured)
    if (!currentPeriod) {
      const zeroMoney = objects.Money.create(0, props.issueCurrency);
      if (!zeroMoney.success) return zeroMoney;

      const zeroPercent = objects.Percentage.zero();
      if (!zeroPercent.success) return zeroPercent;

      return ResultHelper.success({
        amountMoney: zeroMoney.value,
        amountPercent: zeroPercent.value,
        accruedDays: 0,
        periodStartDate: settlementDate,
        periodEndDate: settlementDate,
        settlementDate: settlementDate,
      });
    }

    // Settlement exactly on payment date = no accrued interest
    if (settlementDate.equals(currentPeriod.paymentDate)) {
      const zeroMoney = objects.Money.create(0, props.issueCurrency);
      if (!zeroMoney.success) return zeroMoney;

      const zeroPercent = objects.Percentage.zero();
      if (!zeroPercent.success) return zeroPercent;

      return ResultHelper.success({
        amountMoney: zeroMoney.value,
        amountPercent: zeroPercent.value,
        accruedDays: 0,
        periodStartDate: currentPeriod.periodStartDate,
        periodEndDate: currentPeriod.periodEndDate,
        settlementDate: settlementDate,
      });
    }

    const calcInput: formulas.AccruedInterestFixedInput = {
      faceValue: props.faceValue!,
      fixedRate: props.fixedRate!,
      frequency: props.frequency!,
      periodStartDate: currentPeriod.periodStartDate,
      periodEndDate: currentPeriod.periodEndDate,
      settlementDate: settlementDate,
      dayCountConvention: props.dayCountConvention,
    };

    const calcValidation = formulas.validateAccruedInterestFixed(calcInput);
    if (!calcValidation.success) {
      return ResultHelper.addContext(
        calcValidation,
        "Accrued Interest Formula"
      );
    }

    const accruedAmount = formulas.calculateAccruedInterestFixed(calcInput);
    if (!accruedAmount.success) {
      return ResultHelper.addContext(accruedAmount, "Accrued Interest Formula");
    }

    return accruedAmount;
  }
}
