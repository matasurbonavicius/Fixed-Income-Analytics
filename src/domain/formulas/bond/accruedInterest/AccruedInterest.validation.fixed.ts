import { Result, ResultHelper } from "@domain/shared";
import { AccruedInterestFixedInput } from "./AccruedInterest.types";
import { validateFrequency, validateFixedRate, validateFaceValue } from "@domain/formulas";

/**
 * Validate inputs for fixed rate bond accrued interest calculation
 * Returns Result.success(input) if valid, Result.failure with all errors if invalid
 */
export function validateAccruedInterestFixed(
  input: AccruedInterestFixedInput
): Result<string | undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateFaceValue(input.faceValue));
  errors.push(...validateFixedRate(input.fixedRate));
  errors.push(...validateFrequency(input.frequency));

  // Date relationship validations
  if (input.periodStartDate >= input.periodEndDate) {
    errors.push("periodStartDate must be before periodEndDate");
  }

  if (input.settlementDate < input.periodStartDate) {
    errors.push("settlementDate must be on or after periodStartDate");
  }

  if (input.settlementDate > input.periodEndDate) {
    errors.push("settlementDate must be on or before periodEndDate");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}