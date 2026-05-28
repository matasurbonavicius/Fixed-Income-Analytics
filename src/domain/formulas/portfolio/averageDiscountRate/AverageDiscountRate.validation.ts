import { AverageDiscountRateInput } from "./AverageDiscountRate.types";
import { validatePositions } from '@domain/formulas';
import { Result, ResultHelper } from "@domain/shared";

/**
 * Validate portfolio has bonds with discount rates for averaging
 */
export function validatePortfolioAverageDiscountRate(
  input: AverageDiscountRateInput
): Result<undefined> {
  const errors: string[] = [];

  errors.push(...validatePositions(input.positions, input.baseCurrency));
  
  for (const position of input.positions) {
    if (position.bond.props.metrics?.discountRate === undefined) {
      errors.push(`Position ${position.bond.props.id.primary} has no Discount rate calculated`)
    }

    if (position.bond.props.metrics?.cleanPrice === undefined) {
      errors.push(`Position ${position.bond.props.id.primary} has no Clean price calculated`)
    }
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
