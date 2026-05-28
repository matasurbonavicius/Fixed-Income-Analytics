import { Currency } from "@domain/valueObjects";
import { PortfolioPosition } from "@domain/entities";

export interface AverageDiscountRateInput {
  positions: PortfolioPosition[];
  baseCurrency: Currency;
}