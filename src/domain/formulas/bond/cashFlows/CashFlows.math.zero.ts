import { Result, ResultHelper } from "@domain/shared";
import {
  CashFlowSchedule,
  CashFlowZeroInput,
  CashFlow,
} from "./CashFlows.types";
import { Money } from "@domain/valueObjects";

/** @internal */
export function generateCashFlowsZero(
  input: CashFlowZeroInput
): Result<CashFlowSchedule> {

  const cashFlows: CashFlow[] = [];

  // Initialize total outflows
  const totalOutflowsResult = Money.zero(input.currency);
  if (!totalOutflowsResult.success) {
    return totalOutflowsResult;
  }
  let totalOutflows = totalOutflowsResult.value;

  // Add initial outflow if price is provided
  if (input.dirtyPrice !== undefined) {
    const negativeOutflowResult = input.dirtyPrice.negate();
    if (!negativeOutflowResult.success) {
      return negativeOutflowResult;
    }

    // Calculate percentage of par for description
    const percentResult = input.dirtyPrice.divide(input.faceValue.amount);
    if (!percentResult.success) {
      return percentResult;
    }
    const percentOfParResult = percentResult.value.multiply(100);
    if (!percentOfParResult.success) {
      return percentOfParResult;
    }

    cashFlows.push({
      date: input.settlementDate,
      amount: negativeOutflowResult.value,
      type: "INITIAL_OUTFLOW",
      description: `Purchase at ${percentOfParResult.value.amount.toFixed(4)}% of par`,
    });

    const addOutflowResult = totalOutflows.add(input.dirtyPrice);
    if (!addOutflowResult.success) {
      return addOutflowResult;
    }
    totalOutflows = addOutflowResult.value;
  }

  // Add principal repayment at maturity
  cashFlows.push({
    date: input.maturityDate,
    amount: input.faceValue,
    type: "PRINCIPAL",
    description: "Principal repayment at maturity (zero coupon bond)",
  });

  const totalInflows = input.faceValue;

  // Calculate net cash flow
  const netCashFlowResult = totalInflows.subtract(totalOutflows);
  if (!netCashFlowResult.success) {
    return netCashFlowResult;
  }

  return ResultHelper.success({
    bondId: input.bondId,
    currency: input.currency,
    settlementDate: input.settlementDate,
    cashFlows: cashFlows,
    totalInflows: totalInflows,
    totalOutflows: totalOutflows,
    netCashFlow: netCashFlowResult.value,
  });
}
