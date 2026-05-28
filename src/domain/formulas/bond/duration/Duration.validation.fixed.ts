import { Result, ResultHelper } from "@domain/shared";
import { MacaulayDurationFixedInput } from "./Duration.types";
import { validateFaceValue, validateFixedRate, validateFrequency } from "@domain/formulas";

export function validateDurationFixed(
  input: MacaulayDurationFixedInput
): Result<undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateFaceValue(input.faceValue));
  errors.push(...validateFixedRate(input.fixedRate));
  errors.push(...validateFrequency(input.frequency));
  errors.push(...validateFixedRate(input.yield)); // Works, too

  // Date validations
  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }

  // Future coupons validation
  if (!input.futureCoupons || input.futureCoupons.length === 0) {
    errors.push("Future coupons are required and must not be empty");
  }

  // Compounding frequency validation
  if (input.compoundingFrequency !== undefined && input.compoundingFrequency <= 0) {
    errors.push("Compounding frequency must be positive");
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
