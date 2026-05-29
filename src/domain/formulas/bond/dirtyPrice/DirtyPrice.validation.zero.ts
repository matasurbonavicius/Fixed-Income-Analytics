import { Result, ResultHelper } from "@domain/shared";
import { DirtyPriceZeroFromYieldInput } from "./DirtyPrice.types";
import { validateFaceValue, validateDiscountRate } from "@domain/formulas";

/** @internal */
export function validateDirtyPriceZero(
  input: DirtyPriceZeroFromYieldInput
): Result<undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateFaceValue(input.faceValue));
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
