import { Money, Currency } from "@domain/valueObjects";
import { PortfolioPosition } from "@domain/entities";

/**
 * @category Results & Types
 */
export interface PortfolioDurationInput {
  positions: PortfolioPosition[];
  baseCurrency: Currency;
}

/**
 * @category Results & Types
 */
export interface PortfolioDurationResult {
  portfolioMacaulayDuration: number; // in years
  portfolioModifiedDuration: number; // price sensitivity
  portfolioDollarDuration: Money; // dollar change for 1% yield change
}