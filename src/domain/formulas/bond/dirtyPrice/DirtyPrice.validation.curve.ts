import { Result, ResultHelper } from "@domain/shared";
import {
  DirtyPriceFixedFromCurveInput,
  DirtyPriceZeroFromCurveInput,
} from "./DirtyPrice.types";
import { validateFixedRate, validateFrequency } from "@domain/formulas";

/** @internal */
export function validateDirtyPriceFixedFromCurve(
  input: DirtyPriceFixedFromCurveInput
): Result<undefined> {
  const errors: string[] = [];

  errors.push(...validateFixedRate(input.fixedRate));
  errors.push(...validateFrequency(input.frequency));

  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}

/** @internal */
export function validateDirtyPriceZeroFromCurve(
  input: DirtyPriceZeroFromCurveInput
): Result<undefined> {
  if (input.settlementDate >= input.maturityDate) {
    return ResultHelper.failure("Settlement date must be before maturity date");
  }

  return ResultHelper.success(undefined);
}
