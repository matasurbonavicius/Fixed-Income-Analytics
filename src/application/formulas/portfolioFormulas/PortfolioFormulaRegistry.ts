import { PortfolioFormula } from "./PortfolioFormula";
import {
  PortfolioCashFlowsFormula,
  TotalMarketValueFormula,
  PortfolioDurationFormula,
  AverageDiscountRateFormula,
} from "./formulas";

/**
 * @category Formula Registry
 */
export const ALL_PORTFOLIO_FORMULAS: PortfolioFormula[] = [
  new PortfolioCashFlowsFormula(),
  new TotalMarketValueFormula(),
  new PortfolioDurationFormula(),
  new AverageDiscountRateFormula(),
];

/**
 * Get formula by ID
 */
/**
 * @category Formula Registry
 */
export function getPortfolioFormulaById(
  id: string
): PortfolioFormula | undefined {
  return ALL_PORTFOLIO_FORMULAS.find((f) => f.id === id);
}

/**
 * Get all formula IDs
 */
/**
 * @category Formula Registry
 */
export function getAllPortfolioFormulaIds(): string[] {
  return ALL_PORTFOLIO_FORMULAS.map((f) => f.id);
}
