import { PortfolioFormula } from "./PortfolioFormula";
import {
  PortfolioCashFlowsFormula,
  TotalMarketValueFormula,
  PortfolioDurationFormula,
  AverageDiscountRateFormula,
} from "./formulas";

export const ALL_PORTFOLIO_FORMULAS: PortfolioFormula[] = [
  new PortfolioCashFlowsFormula(),
  new TotalMarketValueFormula(),
  new PortfolioDurationFormula(),
  new AverageDiscountRateFormula(),
];

/**
 * Get formula by ID
 */
export function getPortfolioFormulaById(
  id: string
): PortfolioFormula | undefined {
  return ALL_PORTFOLIO_FORMULAS.find((f) => f.id === id);
}

/**
 * Get all formula IDs
 */
export function getAllPortfolioFormulaIds(): string[] {
  return ALL_PORTFOLIO_FORMULAS.map((f) => f.id);
}
