import { Bond } from "@domain/entities";
import { Currency, Money, Percentage, UTCDate } from "@domain/valueObjects";
import { PortfolioCashFlowSchedule, PortfolioDurationResult } from "@domain/formulas";

/**
 * @category Portfolio Types & Shapes
 */
export interface PortfolioPosition {
  bond: Bond;
  quantity: number;
}

/**
 * @category Portfolio Types & Shapes
 */
export interface PortfolioMetrics {
  portfolioId: string;
  calculationDate: UTCDate;

  // Weighted metrics
  portfolioDuration?: PortfolioDurationResult;
  portfolioDiscountRate?: Percentage;

  // Totals
  totalMarketValue?: Money;
  numberOfPositions?: number;

  // Cash flows
  cashFlows?: PortfolioCashFlowSchedule;
}

// ============= MAIN PORTFOLIO PROPS =============
/**
 * @category Portfolio Types & Shapes
 */
export interface PortfolioProps {
  id: string;
  name: string;
  positions: PortfolioPosition[];
  baseCurrency: Currency;
  metrics?: PortfolioMetrics;
}