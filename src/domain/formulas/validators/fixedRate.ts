import { Percentage } from "@domain/valueObjects";

export function validateFixedRate(fixedRate: Percentage): string[] {
  const errors: string[] = [];

  if (fixedRate.asDecimal < 0) {
    errors.push("Fixed rate cannot be negative");
  }

  if (fixedRate.asDecimal > 1) {
    errors.push("Fixed rate cannot exceed 100%");
  }

  return errors;
}