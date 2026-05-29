import { Result, ResultHelper } from "@domain/shared";
import { DirtyPriceFixedFromYieldInput } from "./DirtyPrice.types";
import { validateFaceValue, validateFixedRate, validateFrequency, validateDiscountRate } from "@domain/formulas";

/** @internal */
export function validateDirtyPriceFixed(
  input: DirtyPriceFixedFromYieldInput
): Result<undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateFaceValue(input.faceValue));
  errors.push(...validateFixedRate(input.fixedRate));
  errors.push(...validateFrequency(input.frequency));
  errors.push(...validateDiscountRate(input.discountRate));

  // Date validations
  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
