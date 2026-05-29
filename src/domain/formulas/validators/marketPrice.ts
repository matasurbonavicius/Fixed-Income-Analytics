import { Percentage } from "@domain/valueObjects";

/** @internal */
export function validateMarketPrice(marketPrice: Percentage): string[] {
  const errors: string[] = [];

  if (marketPrice.asDecimal <= 0) {
    errors.push("Market price cannot be negative or zero");
  }

  return errors;
}
