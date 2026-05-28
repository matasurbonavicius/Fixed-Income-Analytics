import { Result, ResultHelper } from "@domain/shared";
import { Money, Percentage } from "@domain/valueObjects";
import { AverageDiscountRateInput } from "./AverageDiscountRate.types";

/**
 * Calculate weighted average discount rate
 * Weights based on market value (quantity × clean price)
 *
 * Formula: Σ(discount_rate_i × weight_i)
 * where weight_i = market_value_i / Σ(market_value_i)
 */
export function calculateAverageDiscountRate(
  input: AverageDiscountRateInput
): Result<Percentage> {
  const { positions, baseCurrency } = input;

  // First pass: calculate total market value
  const totalMarketValueResult = Money.zero(baseCurrency);
  if (!totalMarketValueResult.success) {
    return totalMarketValueResult;
  }
  let totalMarketValue = totalMarketValueResult.value;

  const bondData: Array<{ discountRate: Percentage; marketValue: Money }> = [];

  for (const position of positions) {
    const bond = position.bond;
    const discountRateResult = bond.props.metrics?.discountRate;
    const cleanPrice = bond.props.metrics?.cleanPrice;

    if (!discountRateResult || !cleanPrice) {
      continue; // Skip bonds without discount rate or price
    }

    const discountRate = discountRateResult.discountRate;

    // Calculate market value: faceValue × cleanPrice × quantity
    // Step 1: Convert cleanPrice percentage to Money
    const cleanPriceMoneyResult = bond.props.faceValue.multiplyByPercentage(cleanPrice);
    if (!cleanPriceMoneyResult.success) {
      return cleanPriceMoneyResult;
    }

    // Step 2: Multiply by quantity
    const marketValueResult = cleanPriceMoneyResult.value.multiply(position.quantity);
    if (!marketValueResult.success) {
      return marketValueResult;
    }
    const marketValue = marketValueResult.value;

    bondData.push({ discountRate, marketValue });

    // Accumulate total market value
    const addMarketValueResult = totalMarketValue.add(marketValue);
    if (!addMarketValueResult.success) {
      return addMarketValueResult;
    }
    totalMarketValue = addMarketValueResult.value;
  }

  if (bondData.length === 0) {
    return ResultHelper.failure("No bonds with discount rate in portfolio");
  }

  if (totalMarketValue.amount === 0) {
    return ResultHelper.failure("Total portfolio market value is zero");
  }

  // Second pass: calculate weighted average using normalized weights
  const weightedAvgResult = Percentage.zero();
  if (!weightedAvgResult.success) {
    return weightedAvgResult;
  }
  let weightedAvg = weightedAvgResult.value;

  for (const { discountRate, marketValue } of bondData) {
    // Calculate weight: market_value / total_market_value (dimensionless)
    const weight = marketValue.amount / totalMarketValue.amount;

    // Weighted contribution: discount_rate × weight (Percentage × dimensionless = Percentage)
    const weightedContributionResult = discountRate.multiply(weight);
    if (!weightedContributionResult.success) {
      return weightedContributionResult;
    }

    const addResult = weightedAvg.add(weightedContributionResult.value);
    if (!addResult.success) {
      return addResult;
    }
    weightedAvg = addResult.value;
  }

  return ResultHelper.success(weightedAvg);
}