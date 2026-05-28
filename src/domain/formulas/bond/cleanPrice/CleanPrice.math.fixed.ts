import { Result } from "@domain/shared";
import { Percentage } from "@domain/valueObjects";
import { CleanPriceFixedFromDirtyInput } from "./CleanPrice.types";

/**
 * Calculate clean price for fixed rate from dirty price
 * Formula: Clean Price = Dirty Price - Accrued Interest
 */
export function calculateCleanPriceFixedFromDirty(
  input: CleanPriceFixedFromDirtyInput
): Result<Percentage> {
  return input.dirtyPrice.subtract(input.accruedInterest.amountPercent);
}
