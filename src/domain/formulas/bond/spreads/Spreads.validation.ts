import { Result, ResultHelper } from "@domain/shared";
import { ZSpreadFixedInput, ZSpreadZeroInput } from "./Spreads.types";
import { validateFixedRate, validateFrequency } from "@domain/formulas";

/** @internal */
export function validateZSpreadFixed(
  input: ZSpreadFixedInput
): Result<undefined> {
  const errors: string[] = [];

  errors.push(...validateFixedRate(input.fixedRate));
  errors.push(...validateFrequency(input.frequency));

  if (input.dirtyPrice.asDecimal <= 0) {
    errors.push("Dirty price must be positive");
  }
  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }
  if (!input.futureCoupons || input.futureCoupons.length === 0) {
    errors.push("Future coupons are required and must not be empty");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}

/** @internal */
export function validateZSpreadZero(input: ZSpreadZeroInput): Result<undefined> {
  const errors: string[] = [];

  if (input.dirtyPrice.asDecimal <= 0) {
    errors.push("Dirty price must be positive");
  }
  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
