import { PortfolioFormula } from "../PortfolioFormula";
import { CalculationEngine } from "@application/core";
import { Result, ResultHelper } from "@domain/shared";
import { Portfolio } from "@domain/entities";
import { Money } from "@domain/valueObjects";
import * as TotalMarketValueDomain from "@domain/formulas";
import { validatePortfolioTotalMarketValue } from "@domain/formulas";

/**
 * Calculate total market value of portfolio
 * TotalMarketValue = Σ(quantity_i × cleanPrice_i)
 */
export class TotalMarketValueFormula extends PortfolioFormula<Money> {
  constructor() {
    super("totalMarketValue");
  }

  async execute(engine: CalculationEngine): Promise<Result<Money>> {
    const portfolio = engine.getEntityData() as Portfolio;
    const positions = portfolio.props.positions;
    const baseCurrency = portfolio.props.baseCurrency;

    // Validate
    const validationErrors = validatePortfolioTotalMarketValue({
      positions,
      baseCurrency,
    });
    if (!validationErrors.success) {
      return ResultHelper.addContext(
        validationErrors,
        "Portfolio Total Market Value Formula"
      );
    }

    // Calculate
    const totalValue = TotalMarketValueDomain.calculateTotalMarketValue({
      positions,
      baseCurrency,
    });

    return totalValue;
  }
}
