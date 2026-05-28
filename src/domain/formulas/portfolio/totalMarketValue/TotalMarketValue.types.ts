import { Money, Currency } from "@domain/valueObjects";
import { PortfolioPosition } from "@domain/entities";

export interface TotalMarketValueInput {
  positions: PortfolioPosition[];
  baseCurrency: Currency;
}

export interface TotalMarketValueResult {
  totalMarketValue: Money;
}
