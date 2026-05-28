import { Money } from "@domain/valueObjects";

export function validateCleanPrice(cleanPrice: Money): string[] {
  const errors: string[] = [];

  if (cleanPrice.isZero()) {
    errors.push("Clean price cannot be zero");
  }

  if (cleanPrice.isNegative()) {
    errors.push("Clean price must be positive");
  }

  return errors;
}
