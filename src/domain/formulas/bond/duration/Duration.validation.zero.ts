import { Result, ResultHelper } from "@domain/shared";
import { MacaulayDurationZeroInput } from "./Duration.types";

/** @internal */
export function validateDurationZero(
  input: MacaulayDurationZeroInput
): Result<undefined> {
  const errors: string[] = [];

  // Date validations
  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }

  // Discount rate validation
  if (input.discountRate.asDecimal < 0) {
    errors.push("Yield cannot be negative");
  }

  // Clean price validation
  if (input.cleanPrice.asDecimal <= 0) {
    errors.push("Clean price must be positive");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
