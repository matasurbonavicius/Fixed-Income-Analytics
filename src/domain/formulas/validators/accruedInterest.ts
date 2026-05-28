import { AccruedInterestResult } from "../bond";

export function validateAccruedInterest(accruedInterest: AccruedInterestResult): string[] {
  const errors: string[] = [];

  if (accruedInterest.amountPercent.asDecimal < 0) {
    errors.push("Accrued interest cannot be negative");
  }

  return errors;
}
