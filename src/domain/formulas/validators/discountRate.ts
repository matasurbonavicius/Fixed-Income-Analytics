import { Percentage } from "@domain/valueObjects";

/** @internal */
export function validateDiscountRate(discountRate: Percentage): string[] {
  const errors: string[] = [];

  if (discountRate.asDecimal < 0) {
    errors.push("Discount rate cannot be negative");
  }

  return errors;
}
