import { Result, ResultHelper } from "@domain/shared";
import { CleanPriceFixedFromDirtyInput } from "./CleanPrice.types";
import { validateDirtyPrice, validateAccruedInterest } from "@domain/formulas";

export function validateCleanPriceFixed(
  input: CleanPriceFixedFromDirtyInput
): Result<undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateDirtyPrice(input.dirtyPrice));
  errors.push(...validateAccruedInterest(input.accruedInterest));

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
