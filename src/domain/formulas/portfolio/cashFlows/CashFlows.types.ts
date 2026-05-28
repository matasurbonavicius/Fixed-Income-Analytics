import { Currency, Money, UTCDate } from "@domain/valueObjects";
import { PortfolioPosition } from "@domain/entities";

export interface PortfolioAggregatedCashFlow {
  date: UTCDate;
  amount: Money;
  description: string;
}

export interface PortfolioCashFlowSchedule {
  portfolioId: string;
  baseCurrency: Currency;
  settlementDate: UTCDate;
  cashFlows: PortfolioAggregatedCashFlow[];
  totalInflows: Money;
  totalOutflows: Money;
  netCashFlow: Money;
  numberOfBonds: number;
}

export interface PortfolioCashFlowInput {
  portfolioId: string;
  positions: PortfolioPosition[];
  baseCurrency: Currency;
  settlementDate: UTCDate;
}
