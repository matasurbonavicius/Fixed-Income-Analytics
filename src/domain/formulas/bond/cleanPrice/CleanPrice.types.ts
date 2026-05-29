import { Percentage } from "@domain/valueObjects";
import { AccruedInterestResult } from "../accruedInterest";

// ZERO
/**
 * @category Results & Types
 */
export interface CleanPriceZeroFromDirtyInput {
  dirtyPrice: Percentage;
}

// FIXED
/**
 * @category Results & Types
 */
export interface CleanPriceFixedFromDirtyInput {
  dirtyPrice: Percentage;
  accruedInterest: AccruedInterestResult;
}
