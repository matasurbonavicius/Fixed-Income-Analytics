import { Money } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";
import {
  PortfolioDurationInput,
  PortfolioDurationResult,
} from "./Duration.types";

/**
 * Calculate weighted average duration metrics for a portfolio
 * Weights based on market value (face value × clean price)
 */
export function calculatePortfolioDuration(
  input: PortfolioDurationInput
): Result<PortfolioDurationResult> {
  const { positions, baseCurrency } = input;

  const totalMarketValueResult = Money.zero(baseCurrency);
  if (!totalMarketValueResult.success) {
    return totalMarketValueResult;
  }
  let totalMarketValue = totalMarketValueResult.value;

  const totalDollarDurationResult = Money.zero(baseCurrency);
  if (!totalDollarDurationResult.success) {
    return totalDollarDurationResult;
  }
  let totalDollarDuration = totalDollarDurationResult.value;

  let weightedMacaulayDurationSum = 0;
  let weightedModifiedDurationSum = 0;

  for (const position of positions) {
    const bond = position.bond;
    const metrics = bond.props.metrics!; // Validator validates
    const cleanPrice = metrics.cleanPrice;

    if (!cleanPrice) {
      return ResultHelper.failure(
        `Bond ${bond.props.id.primary} has no clean price calculated`
      );
    }

    // Get face value from bond
    const faceValue = bond.props.faceValue;

    // Calculate market value: face value × clean price (as %) × quantity
    const singleBondMarketValueResult = faceValue.multiplyByPercentage(cleanPrice);
    if (!singleBondMarketValueResult.success) {
      return singleBondMarketValueResult;
    }

    const marketValueResult = singleBondMarketValueResult.value.multiply(position.quantity);
    if (!marketValueResult.success) {
      return marketValueResult;
    }
    const marketValue = marketValueResult.value;

    // Duration metrics from bond
    const durationResult = metrics.duration;
    if (!durationResult) {
      return ResultHelper.failure(
        `Bond ${bond.props.id.primary} has no duration calculated`
      );
    }

    const macaulayDuration = durationResult.macaulayDuration;
    const modifiedDuration = durationResult.modifiedDuration;
    const dollarDuration = durationResult.dollarDuration;

    // Weighted sums for duration ratios
    // weight = market value amount (in dollars)
    weightedMacaulayDurationSum += macaulayDuration * marketValue.amount;
    weightedModifiedDurationSum += modifiedDuration * marketValue.amount;

    // Dollar duration scaled by quantity
    const scaledDollarDurationResult = dollarDuration.multiply(position.quantity);
    if (!scaledDollarDurationResult.success) {
      return scaledDollarDurationResult;
    }

    const addDollarDurationResult = totalDollarDuration.add(scaledDollarDurationResult.value);
    if (!addDollarDurationResult.success) {
      return addDollarDurationResult;
    }
    totalDollarDuration = addDollarDurationResult.value;

    // Accumulate total market value
    const addMarketValueResult = totalMarketValue.add(marketValue);
    if (!addMarketValueResult.success) {
      return addMarketValueResult;
    }
    totalMarketValue = addMarketValueResult.value;
  }

  if (totalMarketValue.amount === 0) {
    return ResultHelper.failure("Total portfolio market value is zero");
  }

  // Calculate weighted averages for Macaulay and Modified durations
  const portfolioMacaulayDuration =
    weightedMacaulayDurationSum / totalMarketValue.amount;
  const portfolioModifiedDuration =
    weightedModifiedDurationSum / totalMarketValue.amount;

  // Dollar duration is just the sum (represents total dollar change for 1% yield change)
  return ResultHelper.success<PortfolioDurationResult>({
    portfolioMacaulayDuration,
    portfolioModifiedDuration,
    portfolioDollarDuration: totalDollarDuration,
  });
}