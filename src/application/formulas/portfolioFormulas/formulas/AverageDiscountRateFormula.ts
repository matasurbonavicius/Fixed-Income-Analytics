import { PortfolioFormula } from "../PortfolioFormula";
import { CalculationEngine } from "@application/core";
import { Result, ResultHelper } from "@domain/shared";
import { Portfolio } from "@domain/entities";
import {
  calculateAverageDiscountRate,
  validatePortfolioAverageDiscountRate,
} from "@domain/formulas";
import { Percentage } from "@domain/valueObjects";

/**
 * Calculate weighted average discount rate of portfolio
 * DiscountRate_portfolio = Σ(DiscountRate_i × Weight_i)
 * Where Weight_i = MarketValue_i / TotalMarketValue
 *
 * @internal
 */
export class AverageDiscountRateFormula extends PortfolioFormula<Percentage> {
  constructor() {
    // ID must match the PortfolioMetrics field name - buildMetrics writes results
    // into metrics[formulaId], and the DTO mapper reads metrics.portfolioDiscountRate.
    super("portfolioDiscountRate");
  }

  async execute(engine: CalculationEngine): Promise<Result<Percentage>> {
    const portfolio = engine.getEntityData() as Portfolio;
    const positions = portfolio.props.positions;
    const baseCurrency = portfolio.props.baseCurrency;

    // Validate
    const validationErrors = validatePortfolioAverageDiscountRate({
      positions,
      baseCurrency,
    });
    if (!validationErrors.success) {
      return ResultHelper.addContext(
        validationErrors,
        "Portfolio Discount Rate Formula"
      );
    }

    // Calculate
    return calculateAverageDiscountRate({
      positions,
      baseCurrency,
    });
  }
}
