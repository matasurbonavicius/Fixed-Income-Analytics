import { Result, ResultHelper } from "@domain/shared";
import { Percentage } from "@domain/valueObjects";
import { CleanPriceZeroFromDirtyInput } from "./CleanPrice.types";

/**
 * Calculate clean price for zero coupon from dirty price
 * For zero coupon: clean price = dirty price (no accrued interest)
 *
 * @internal
 */
export function calculateCleanPriceZeroFromDirty(
  input: CleanPriceZeroFromDirtyInput
): Result<Percentage> {
  return ResultHelper.success(input.dirtyPrice);
}
