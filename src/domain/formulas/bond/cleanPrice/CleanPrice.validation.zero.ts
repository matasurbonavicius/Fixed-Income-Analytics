import { Result, ResultHelper } from "@domain/shared";
import { CleanPriceZeroFromDirtyInput } from "./CleanPrice.types";
import { validateDirtyPrice } from "@domain/formulas";

/** @internal */
export function validateCleanPriceZero(
  input: CleanPriceZeroFromDirtyInput
): Result<undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateDirtyPrice(input.dirtyPrice));

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
