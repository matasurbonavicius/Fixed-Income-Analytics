import { TotalMarketValueInput } from "./TotalMarketValue.types";
import { Money } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

/**
 * Calculate total market value of portfolio
 * Sum of (quantity × clean price) for all positions
 *
 * @internal
 */
export function calculateTotalMarketValue(
  input: TotalMarketValueInput
): Result<Money> {
  const totalResult = Money.zero(input.baseCurrency);
  if (!totalResult.success) {
    return totalResult;
  }
  let total = totalResult.value;

  for (const position of input.positions) {
    const cleanPrice = position.bond.props.metrics?.cleanPrice;
    if (!cleanPrice) {
      return ResultHelper.failure(
        `Bond ${position.bond.props.id.primary} missing clean price`
      );
    }

    // Calculate market value: faceValue × cleanPrice × quantity
    // Step 1: Convert cleanPrice percentage to Money
    const cleanPriceMoneyResult = position.bond.props.faceValue.multiplyByPercentage(cleanPrice);
    if (!cleanPriceMoneyResult.success) {
      return cleanPriceMoneyResult;
    }

    // Step 2: Multiply by quantity
    const marketValueResult = cleanPriceMoneyResult.value.multiply(position.quantity);
    if (!marketValueResult.success) {
      return marketValueResult;
    }

    const addResult = total.add(marketValueResult.value);
    if (!addResult.success) {
      return addResult;
    }
    total = addResult.value;
  }

  return ResultHelper.success(total);
} 