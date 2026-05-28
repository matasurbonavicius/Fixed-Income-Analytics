/**
 * Tests for PortfolioCurrencyConverter: skips positions already in the target
 * currency, looks up FX rates (direct and inverted), converts the others,
 * and surfaces failures (no positions, missing market data, missing FX rate).
 */
import { describe, it, expect } from "vitest";
import { PortfolioCurrencyConverter } from "@application/core/utils";
import { Portfolio, PortfolioPosition } from "@domain/entities";
import { MarketData, MarketDataStore } from "@domain/dataStructures";
import {
  Currency,
  CurrencyPair,
  Money,
  UTCDate,
} from "@domain/valueObjects";
import { unwrap } from "../helpers/result";
import { makeFixedRateBond } from "../fixtures/bonds";

const EUR = unwrap(Currency.create("EUR"));
const USD = unwrap(Currency.create("USD"));
const AS_OF = unwrap(UTCDate.fromString("2026-01-16"));

/** A fixture bond re-stamped into USD (issue + analytical + faceValue). */
function usdBond() {
  const { bond } = makeFixedRateBond();
  return bond.update({
    issueCurrency: USD,
    analyticalCurrency: USD,
    faceValue: unwrap(Money.create(1_000_000, USD)),
  });
}

function portfolioWith(positions: PortfolioPosition[]) {
  return Portfolio.create({
    id: "PF-CONV",
    name: "Conversion Test",
    positions,
    baseCurrency: USD,
  });
}

function storeWithFx(rate: { pair: CurrencyPair; rate: number }[]) {
  const md: MarketData = { asOfDate: AS_OF, fxRates: rate };
  return MarketDataStore.create([md]);
}

describe("PortfolioCurrencyConverter.convert", () => {
  it("fails when the portfolio has no positions", () => {
    const pf = portfolioWith([]);
    const result = PortfolioCurrencyConverter.convert(
      pf,
      EUR,
      storeWithFx([]),
      AS_OF
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("no positions");
  });

  it("fails when no market data exists for the as-of date", () => {
    const pf = portfolioWith([{ bond: usdBond(), quantity: 1 }]);
    const emptyStore = MarketDataStore.create([]);
    const result = PortfolioCurrencyConverter.convert(
      pf,
      EUR,
      emptyStore,
      AS_OF
    );
    expect(result.success).toBe(false);
  });

  it("converts a USD bond to EUR using a direct USD/EUR rate", () => {
    const pf = portfolioWith([{ bond: usdBond(), quantity: 2 }]);
    const pair = unwrap(CurrencyPair.create(USD, EUR));
    const store = storeWithFx([{ pair, rate: 0.9 }]);

    const converted = unwrap(
      PortfolioCurrencyConverter.convert(pf, EUR, store, AS_OF)
    );

    expect(converted.props.baseCurrency.code).toBe("EUR");
    const bond = converted.props.positions[0].bond;
    expect(bond.props.analyticalCurrency.code).toBe("EUR");
    // 1,000,000 USD * 0.9 = 900,000 EUR
    expect(bond.props.faceValue.amount).toBeCloseTo(900_000, 4);
    // quantity preserved
    expect(converted.props.positions[0].quantity).toBe(2);
  });

  it("converts using an inverted rate when only EUR/USD is quoted", () => {
    const pf = portfolioWith([{ bond: usdBond(), quantity: 1 }]);
    // Only the EUR/USD pair is present; converter must invert it for USD->EUR.
    const pair = unwrap(CurrencyPair.create(EUR, USD));
    const store = storeWithFx([{ pair, rate: 1.25 }]); // => USD/EUR = 0.8

    const converted = unwrap(
      PortfolioCurrencyConverter.convert(pf, EUR, store, AS_OF)
    );
    const bond = converted.props.positions[0].bond;
    expect(bond.props.faceValue.amount).toBeCloseTo(800_000, 4);
  });

  it("skips a position already in the target currency (no FX needed)", () => {
    const { bond } = makeFixedRateBond(); // EUR bond
    const pf = Portfolio.create({
      id: "PF-EUR",
      name: "Already EUR",
      positions: [{ bond, quantity: 3 }],
      baseCurrency: EUR,
    });
    // No FX rates supplied; skip path must not need any.
    const store = storeWithFx([]);
    const converted = unwrap(
      PortfolioCurrencyConverter.convert(pf, EUR, store, AS_OF)
    );
    expect(converted.props.positions[0].bond).toBe(bond);
    expect(converted.props.baseCurrency.code).toBe("EUR");
  });

  it("fails when no FX rate is found for the bond's currency", () => {
    const pf = portfolioWith([{ bond: usdBond(), quantity: 1 }]);
    const store = storeWithFx([]); // no rates at all
    const result = PortfolioCurrencyConverter.convert(pf, EUR, store, AS_OF);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No FX rate");
  });

  it("clears portfolio metrics on conversion", () => {
    const pf = Portfolio.create({
      id: "PF-CONV",
      name: "x",
      positions: [{ bond: usdBond(), quantity: 1 }],
      baseCurrency: USD,
      metrics: { portfolioId: "PF-CONV" } as any,
    });
    const pair = unwrap(CurrencyPair.create(USD, EUR));
    const converted = unwrap(
      PortfolioCurrencyConverter.convert(
        pf,
        EUR,
        storeWithFx([{ pair, rate: 0.9 }]),
        AS_OF
      )
    );
    expect(converted.props.metrics).toBeUndefined();
  });
});
