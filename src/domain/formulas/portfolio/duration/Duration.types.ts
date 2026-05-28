import { Money, Currency } from "@domain/valueObjects";
import { PortfolioPosition } from "@domain/entities";

export interface PortfolioDurationInput {
  positions: PortfolioPosition[];
  baseCurrency: Currency;
}

export interface PortfolioDurationResult {
  portfolioMacaulayDuration: number; // in years
  portfolioModifiedDuration: number; // price sensitivity
  portfolioDollarDuration: Money; // dollar change for 1% yield change
}