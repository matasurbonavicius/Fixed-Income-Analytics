import { Result, ResultHelper } from "@domain/shared";
/**
 * For zero coupon there is nothing to validate. Clean price = dirty price
 */
export function validateAccruedInterestZero(
): Result<string | undefined> {
  return ResultHelper.success(undefined);
}