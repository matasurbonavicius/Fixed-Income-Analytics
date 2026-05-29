import { PortfolioFormula } from "../PortfolioFormula";
import { CalculationEngine } from "@application/core";
import { Result, ResultHelper } from "@domain/shared";
import { Portfolio } from "@domain/entities";
import * as formulasDomain from "@domain/formulas";

/**
 * Calculate aggregated portfolio cash flows
 * Combines all bond cash flows by date across the portfolio
 *
 * @internal
 */
export class PortfolioCashFlowsFormula extends PortfolioFormula<formulasDomain.PortfolioCashFlowSchedule> {
  constructor() {
    super("cashFlows");
  }

  async execute(
    engine: CalculationEngine
  ): Promise<Result<formulasDomain.PortfolioCashFlowSchedule>> {
    const portfolio = engine.getEntityData() as Portfolio;
    const settlementDate = engine.getOptions().settlementDate;
    const positions = portfolio.props.positions;
    const baseCurrency = portfolio.props.baseCurrency;

    // Validate
    const validationErrors = formulasDomain.validatePortfolioCashFlows({
      portfolioId: portfolio.props.id,
      positions,
      baseCurrency,
      settlementDate,
    });
    if (!validationErrors.success) {
      return ResultHelper.addContext(
        validationErrors,
        "Portfolio Cash Flows Formula"
      );
    }

    // Calculate aggregated cash flows
    return formulasDomain.calculatePortfolioCashFlows({
      portfolioId: portfolio.props.id,
      positions,
      baseCurrency,
      settlementDate,
    });
  }
}
