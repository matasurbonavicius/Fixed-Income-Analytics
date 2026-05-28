import { Percentage } from "@domain/valueObjects";
import { AccruedInterestResult } from "../accruedInterest";

// ZERO
export interface CleanPriceZeroFromDirtyInput {
  dirtyPrice: Percentage;
}

// FIXED
export interface CleanPriceFixedFromDirtyInput {
  dirtyPrice: Percentage;
  accruedInterest: AccruedInterestResult;
}
