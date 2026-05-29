import { Percentage } from "@domain/valueObjects";

/** @internal */
export function validateDirtyPrice(dirtyPrice: Percentage): string[] {
  const errors: string[] = [];

  if (dirtyPrice.isZero()) {
    errors.push("Dirty price cannot be zero");
  }

  if (dirtyPrice.isNegative()) {
    errors.push("Dirty price must be positive");
  }

  return errors;
}
