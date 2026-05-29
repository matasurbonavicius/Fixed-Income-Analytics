import { Result, ResultHelper } from "@domain/shared";
import {
  CashFlowSchedule,
  CashFlowFixedInput,
  CashFlow,
} from "./CashFlows.types";
import { Money } from "@domain/valueObjects/Money";

/** @internal */
export function generateCashFlowsFixed(
  input: CashFlowFixedInput
): Result<CashFlowSchedule> {
  const cashFlows: CashFlow[] = [];

  // Calculate periodic coupon payment using value object methods
  const annualCouponResult = input.faceValue.multiplyByPercentage(
    input.fixedRate
  );
  if (!annualCouponResult.success) {
    return annualCouponResult;
  }

  const couponPaymentResult = annualCouponResult.value.divide(input.frequency);
  if (!couponPaymentResult.success) {
    return couponPaymentResult;
  }
  const couponPayment = couponPaymentResult.value;

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
      description: `Purchase at ${percentOfParResult.value.amount.toFixed(
        4
      )}% of par`,
    });

    const addOutflowResult = totalOutflows.add(input.dirtyPrice);
    if (!addOutflowResult.success) {
      return addOutflowResult;
    }
    totalOutflows = addOutflowResult.value;
  }

  // Initialize total inflows
  const totalInflowsResult = Money.zero(input.currency);
  if (!totalInflowsResult.success) {
    return totalInflowsResult;
  }
  let totalInflows = totalInflowsResult.value;

  // Add all coupon payments
  for (const coupon of input.futureCoupons) {
    cashFlows.push({
      date: coupon.paymentDate,
      amount: couponPayment,
      type: "COUPON",
      description: `Coupon payment (${input.fixedRate.asPercent.toFixed(
        2
      )}% annual)`,
    });

    const addInflowResult = totalInflows.add(couponPayment);
    if (!addInflowResult.success) {
      return addInflowResult;
    }
    totalInflows = addInflowResult.value;
  }

  // Principal is repaid at maturity - always, regardless of whether a coupon
  // also lands on that date. They are separate financial events.
  //
  // The previous implementation gated the principal on
  // `lastCoupon.paymentDate.equals(maturityDate)`, which silently dropped the
  // principal whenever the last coupon date and the bond's maturity date
  // diverged by even a millisecond (e.g. after a business-day adjustment).
  cashFlows.push({
    date: input.maturityDate,
    amount: input.faceValue,
    type: "PRINCIPAL",
    description: "Principal repayment at maturity",
  });

  const addPrincipalResult = totalInflows.add(input.faceValue);
  if (!addPrincipalResult.success) {
    return addPrincipalResult;
  }
  totalInflows = addPrincipalResult.value;

  // Calculate net cash flow
  const netCashFlowResult = totalInflows.subtract(totalOutflows);
  if (!netCashFlowResult.success) {
    return netCashFlowResult;
  }

  // Sort by date
  cashFlows.sort((a, b) => {
    if (a.date.equals(b.date)) return 0;
    return a.date.isBefore(b.date) ? -1 : 1;
  });

  return ResultHelper.success({
    bondId: input.bondId,
    currency: input.currency,
    settlementDate: input.settlementDate,
    cashFlows,
    totalInflows,
    totalOutflows,
    netCashFlow: netCashFlowResult.value,
  });
}
