import { CashFlowFixedInput } from "./CashFlows.types";
import { Result, ResultHelper } from "@domain/shared";
import { validateFaceValue, validateFixedRate, validateFrequency } from "@domain/formulas";

/** @internal */
export function validateCashFlowFixed(
  input: CashFlowFixedInput
): Result<undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateFaceValue(input.faceValue));
  errors.push(...validateFixedRate(input.fixedRate));
  errors.push(...validateFrequency(input.frequency));

  // Date validations
  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
