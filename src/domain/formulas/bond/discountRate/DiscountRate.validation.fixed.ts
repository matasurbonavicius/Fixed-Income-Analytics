import { Result, ResultHelper } from "@domain/shared";
import { ImpliedRateFixedInput } from "./DiscountRate.types";
import {
  validateFixedRate,
  validateFrequency,
  validateMarketPrice,
} from "@domain/formulas";

export function validateImpliedRateFixed(
  input: ImpliedRateFixedInput
): Result<undefined> {
  const errors: string[] = [];

  // Shared validators
  errors.push(...validateFixedRate(input.fixedRate));
  errors.push(...validateFrequency(input.frequency));
  errors.push(...validateMarketPrice(input.cleanPrice));

  // Date validations
  if (input.settlementDate >= input.maturityDate) {
    errors.push("Settlement date must be before maturity date");
  }

  // Future coupons validation
  if (input.futureCoupons.length === 0) {
    errors.push("Future coupons must not be empty");
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
