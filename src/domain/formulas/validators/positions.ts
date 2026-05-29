import { PortfolioPosition } from "@domain/entities";
import { Currency } from "@domain/valueObjects";

/** @internal */
export function validatePositions(
  positions: PortfolioPosition[],
  baseCurrency: Currency
): string[] {
  const errors: string[] = [];

  if (!positions || positions.length === 0) {
    errors.push("There are no position in the portfolio");
  }

  for (const position of positions) {
    const bond = position.bond;
    const bondId = bond.props.id.primary;

    // Check metrics exist
    if (!bond.props.metrics) {
      errors.push(`Bond ${bondId} has no metrics calculated`);
      continue;
    }

    // Check quantity is valid
    if (!Number.isFinite(position.quantity) || position.quantity <= 0) {
      errors.push(`Bond ${bondId} has invalid quantity: ${position.quantity}`);
    }

    // Check currency alignment
    if (!bond.props.analyticalCurrency.equals(baseCurrency)) {
      errors.push(
        `Bond ${bondId} analytical currency ${bond.props.analyticalCurrency.code} does not match portfolio base currency ${baseCurrency.code}`
      );
    }
  }

  return errors;
}
