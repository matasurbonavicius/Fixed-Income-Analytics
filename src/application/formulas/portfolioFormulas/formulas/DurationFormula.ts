import { PortfolioFormula } from "../PortfolioFormula";
import { CalculationEngine } from "@application/core";
import { Result, ResultHelper } from "@domain/shared";
import { Portfolio } from "@domain/entities";
import * as PortfolioYieldDomain from "@domain/formulas";
import { validatePortfolioDuration } from "@domain/formulas";
import { PortfolioDurationResult } from "@domain/formulas";

export class PortfolioDurationFormula extends PortfolioFormula<PortfolioDurationResult> {
  constructor() {
    super("portfolioDuration");
  }

  async execute(
    engine: CalculationEngine
  ): Promise<Result<PortfolioDurationResult>> {
    const portfolio = engine.getEntityData() as Portfolio;
    const positions = portfolio.props.positions;
    const baseCurrency = portfolio.props.baseCurrency;

    // Validate
    const validationErrors = validatePortfolioDuration({
      positions,
      baseCurrency,
    });
    if (!validationErrors.success) {
      return ResultHelper.addContext(
        validationErrors,
        "Portfolio Duration Formula"
      );
    }

    return PortfolioYieldDomain.calculatePortfolioDuration({
      positions,
      baseCurrency,
    });
  }
}
