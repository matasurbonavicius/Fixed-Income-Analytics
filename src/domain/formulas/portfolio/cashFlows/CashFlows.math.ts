import { Result, ResultHelper } from "@domain/shared";
import { Money, UTCDate } from "@domain/valueObjects";
import * as types from "./CashFlows.types";

/**
 * Calculate aggregated portfolio cash flows
 * Combines all bond cash flows by date, weighted by quantity
 *
 * @internal
 */
export function calculatePortfolioCashFlows(
  input: types.PortfolioCashFlowInput
): Result<types.PortfolioCashFlowSchedule> {
  const { portfolioId, positions, baseCurrency, settlementDate } = input;

  // Map to aggregate cash flows by date
  const cashFlowsByDate = new Map<string, Money>();

  // Aggregate cash flows from all positions
  for (const position of positions) {
    const bondCashFlows = position.bond.props.metrics!.cashFlows;

    if (!bondCashFlows) {
      return ResultHelper.failure(
        `Bond ${position.bond.props.id.primary} has no cashflows calculated`
      );
    }

    for (const cf of bondCashFlows.cashFlows) {
      const dateKey = cf.date.toISOString();

      // Scale cash flow by position quantity
      const scaledAmountResult = Money.create(
        cf.amount.amount * position.quantity,
        baseCurrency
      );
      if (!scaledAmountResult.success) {
        return scaledAmountResult;
      }
      const scaledAmount = scaledAmountResult.value;

      // Aggregate by date
      const currentAmount = cashFlowsByDate.get(dateKey);
      if (currentAmount) {
        const addResult = currentAmount.add(scaledAmount);
        if (!addResult.success) {
          return addResult;
        }
        cashFlowsByDate.set(dateKey, addResult.value);
      } else {
        cashFlowsByDate.set(dateKey, scaledAmount);
      }
    }
  }

  // Initialize totals
  const totalInflowsResult = Money.zero(baseCurrency);
  if (!totalInflowsResult.success) {
    return totalInflowsResult;
  }
  let totalInflows = totalInflowsResult.value;

  const totalOutflowsResult = Money.zero(baseCurrency);
  if (!totalOutflowsResult.success) {
    return totalOutflowsResult;
  }
  let totalOutflows = totalOutflowsResult.value;

  // Convert map to array
  const aggregatedCashFlows: types.PortfolioAggregatedCashFlow[] = [];

  for (const [dateKey, amount] of cashFlowsByDate.entries()) {
    const dateResult = UTCDate.fromString(dateKey);
    if (!dateResult.success) {
      return ResultHelper.failure(`Invalid date in cash flows: ${dateKey}`);
    }
    const date = dateResult.value;

    // Categorize inflows/outflows
    if (amount.amount > 0) {
      const addResult = totalInflows.add(amount);
      if (!addResult.success) {
        return addResult;
      }
      totalInflows = addResult.value;
    } else if (amount.amount < 0) {
      const absAmountResult = Money.create(
        Math.abs(amount.amount),
        baseCurrency
      );
      if (!absAmountResult.success) {
        return absAmountResult;
      }
      const addResult = totalOutflows.add(absAmountResult.value);
      if (!addResult.success) {
        return addResult;
      }
      totalOutflows = addResult.value;
    }

    // Determine description based on amount
    let description: string;
    if (amount.amount < 0) {
      description = "Portfolio initial outflow (aggregate)";
    } else {
      description = "Portfolio cash inflow (aggregate)";
    }

    aggregatedCashFlows.push({
      date,
      amount,
      description,
    });
  }

  // Sort by date
  aggregatedCashFlows.sort((a, b) => {
    if (a.date.equals(b.date)) return 0;
    return a.date.isBefore(b.date) ? -1 : 1;
  });

  // Calculate net cash flow
  const netCashFlowResult = totalInflows.subtract(totalOutflows);
  if (!netCashFlowResult.success) {
    return netCashFlowResult;
  }

  return ResultHelper.success<types.PortfolioCashFlowSchedule>({
    portfolioId,
    baseCurrency,
    settlementDate,
    cashFlows: aggregatedCashFlows,
    totalInflows,
    totalOutflows,
    netCashFlow: netCashFlowResult.value,
    numberOfBonds: positions.length,
  });
}
