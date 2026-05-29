import { CashFlowZeroInput } from "./CashFlows.types";
import { Result, ResultHelper } from "@domain/shared";
import { validateFaceValue } from "@domain/formulas";

/** @internal */
export function validateCashFlowZero(
  input: CashFlowZeroInput
): Result<undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateFaceValue(input.faceValue));

  // Date validations
  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
