import { Result, ResultHelper } from "@domain/shared";
import { ImpliedRateZeroInput } from "./DiscountRate.types";
import { validateMarketPrice } from "@domain/formulas";

export function validateImpliedRateZero(
  input: ImpliedRateZeroInput
): Result<undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateMarketPrice(input.cleanPrice));

  // Date validations
  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
