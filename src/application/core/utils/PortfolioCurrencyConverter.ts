import { Portfolio, PortfolioPosition } from "@domain/entities";
import { Currency, CurrencyPair, UTCDate } from "@domain/valueObjects";
import { MarketDataStore, MarketData } from "@domain/dataStructures";
import { Result, ResultHelper } from "@domain/shared";

export class PortfolioCurrencyConverter {
  static convert(
    portfolio: Portfolio,
    targetCurrency: Currency,
    marketDataStore: MarketDataStore,
    asOfDate: UTCDate
  ): Result<Portfolio> {
    if (portfolio.props.positions.length === 0) {
      return ResultHelper.failure("Portfolio has no positions");
    }

    const marketDataResult = marketDataStore.getByDate(asOfDate);
    if (!marketDataResult.success) {
      return ResultHelper.addContext(
        marketDataResult,
        "Portfolio Currency Converter"
      );
    }
    const marketData = marketDataResult.value;

    const converted: PortfolioPosition[] = [];

    // Loop through positions and convert each bond
    for (const position of portfolio.props.positions) {
      const bond = position.bond;

      // Skip if already in target currency
      if (bond.props.analyticalCurrency.equals(targetCurrency)) {
        converted.push(position);
        continue;
      }

      // Get FX rate from market data for this bond's currency
      const fxRateResult = this.getFXRate(
        bond.props.issueCurrency,
        targetCurrency,
        marketData
      );
      if (!fxRateResult.success) {
        return fxRateResult;
      }

      // Convert bond
      const convertedBondResult = bond.convertCurrency(
        targetCurrency,
        fxRateResult.value
      );
      if (!convertedBondResult.success) {
        return ResultHelper.addContext(
          convertedBondResult,
          `Portfolio Currency Converter for bond ${bond.props.id.primary}`
        );
      }

      converted.push({ ...position, bond: convertedBondResult.value });
    }

    return ResultHelper.success(
      portfolio.update({
        positions: converted,
        baseCurrency: targetCurrency,
        metrics: undefined,
      })
    );
  }

  private static getFXRate(
    from: Currency,
    to: Currency,
    marketData: MarketData
  ): Result<number> {
    if (!marketData.fxRates || marketData.fxRates.length === 0) {
      return ResultHelper.failure("No FX rates available in market data");
    }

    const pairResult = CurrencyPair.create(from, to);
    if (!pairResult.success) {
      return pairResult;
    }
    const searchPair = pairResult.value;

    // Search for matching pair (direct or inverted)
    for (const fxRate of marketData.fxRates) {
      if (fxRate.pair.equals(searchPair)) {
        return ResultHelper.success(fxRate.rate);
      }

      if (fxRate.pair.matchesInverted(searchPair)) {
        if (fxRate.rate === 0) {
          return ResultHelper.failure("Cannot invert zero FX rate");
        }
        return ResultHelper.success(1 / fxRate.rate);
      }
    }

    return ResultHelper.failure(`No FX rate found for ${from.code}/${to.code}`);
  }
}
