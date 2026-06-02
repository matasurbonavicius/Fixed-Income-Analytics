/**
 * Portfolio demo — prices a 1,000-bond portfolio in one call and measures speed.
 *
 * Builds a portfolio out of 1,000 positions (an even mix of the two
 * Bloomberg-pinned fixtures — a fixed-rate `LITHUN 3.5 07/03/31` and a
 * zero-coupon `LITHGB 0 03/03/28`), each cloned under a unique bond ID and a
 * varied holding size, then runs the whole book through
 * `PortfolioCalculationService.calculate` and prints the aggregate metrics
 * (total market value, weighted duration, weighted discount rate, aggregated
 * cash flows) alongside a wall-clock timing and per-bond throughput.
 *
 * Run from the repository root:
 *   npx tsx examples/portfolio.demo.ts
 */
import { MarketData, MarketDataStore } from "@domain/dataStructures";
import {
  Percentage,
  BondId,
  Currency,
  Money,
  CreditRating,
  UTCDate,
} from "@domain/valueObjects";
import { BondFormulaOptions } from "@domain/specifications";
import { DiscountRateOptions, CashFlowOptions } from "@domain/formulas";
import { Bond, Portfolio, PortfolioPosition } from "@domain/entities";
import { PortfolioCalculationService } from "@application/core";

// Tiny throwing unwrap so the demo stays linear instead of nesting Result checks.
function must<T>(result: { success: true; value: T } | { success: false; error: string }): T {
  if (!result.success) throw new Error(result.error);
  return result.value;
}

const BOND_COUNT = 1_000;

const EUR = must(Currency.create("EUR"));
const asOfDate = must(UTCDate.fromString("2026-01-16"));
const settlementDate = must(UTCDate.fromString("2026-01-20"));

const issueDate = must(UTCDate.fromString("2024-07-03"));
const fixedMaturity = must(UTCDate.fromString("2031-07-03"));
const zeroIssueDate = must(UTCDate.fromString("2021-03-03"));
const zeroMaturity = must(UTCDate.fromString("2028-03-03"));

const faceValue = must(Money.create(1_000_000, EUR));
const creditRating = must(CreditRating.create("A"));
const fixedRate = must(Percentage.fromDecimal(0.035));

// Clean prices that match the two Bloomberg fixtures.
const fixedCleanPrice = must(Percentage.fromDecimal(1.022935)); // 102.2935%
const zeroCleanPrice = must(Percentage.fromDecimal(0.9471615)); // 94.71615%

// === BUILD 1,000 POSITIONS ===
// Each bond gets a unique primary ID so its price resolves independently; we
// alternate fixed/zero and vary the quantity so the aggregates are non-trivial.
const positions: PortfolioPosition[] = [];
const bondPrices: { bondId: BondId; priceType: "clean"; bid: Percentage }[] = [];

for (let i = 0; i < BOND_COUNT; i++) {
  const isFixed = i % 2 === 0;
  const id = must(BondId.create({ primary: `DEMO-${isFixed ? "FIX" : "ZRO"}-${i}` }));

  const bond = isFixed
    ? Bond.create({
        id,
        name: `LITHUN 3.5 07/03/31 #${i}`,
        description: "Lithuania fixed rate bond (cloned for portfolio demo)",
        issueDate,
        issuer: "Republic of Lithuania",
        issuerCountry: "LT",
        bondCategory: "SOVEREIGN",
        issuerSector: "GOVERNMENT",
        issueCurrency: EUR,
        analyticalCurrency: EUR,
        faceValue,
        maturityDate: fixedMaturity,
        settlementDays: 2,
        dayCountConvention: "ACT_ACT",
        businessDayConvention: "MODIFIED_FOLLOWING",
        paymentCalendar: "EUREX",
        creditRating,
        bondType: "FIXED",
        fixedRate,
        frequency: 1,
      })
    : Bond.create({
        id,
        name: `LITHGB 0 03/03/28 #${i}`,
        description: "Lithuania zero rate bond (cloned for portfolio demo)",
        issueDate: zeroIssueDate,
        issuer: "Republic of Lithuania",
        issuerCountry: "LT",
        bondCategory: "SOVEREIGN",
        issuerSector: "GOVERNMENT",
        issueCurrency: EUR,
        analyticalCurrency: EUR,
        faceValue,
        maturityDate: zeroMaturity,
        settlementDays: 2,
        dayCountConvention: "ACT_ACT",
        businessDayConvention: "MODIFIED_FOLLOWING",
        paymentCalendar: "EUREX",
        creditRating,
        bondType: "ZERO",
        frequency: 0,
      });

  // Quantities 1..10, cycling — gives every position a different weight.
  positions.push({ bond, quantity: (i % 10) + 1 });
  bondPrices.push({
    bondId: id,
    priceType: "clean",
    bid: isFixed ? fixedCleanPrice : zeroCleanPrice,
  });
}

// === MARKET DATA ===
// Per-bond price lookup keys off analysisDate; the portfolio currency converter
// keys off settlementDate. Register the same prices under BOTH so every lookup
// resolves (mirrors tests/application/portfolio.test.ts).
const atAsOf: MarketData = { asOfDate, bondPrice: bondPrices };
const atSettle: MarketData = { asOfDate: settlementDate, bondPrice: bondPrices };
const marketDataStore = MarketDataStore.create([atAsOf, atSettle]);

// === CALCULATION OPTIONS ===
const discountRate: DiscountRateOptions = { methods: ["implied_from_price"] };
const cashFlow: CashFlowOptions = { includeInitialOutflow: true };
const options: BondFormulaOptions = {
  settlementDate,
  analysisDate: asOfDate,
  discountRate,
  cashFlow,
};

// === PORTFOLIO ENTITY ===
const portfolio = Portfolio.create({
  id: "PF-DEMO-1000",
  name: "1,000-bond demo portfolio",
  positions,
  baseCurrency: EUR,
});

// === RUN + TIME ===
const start = performance.now();
const result = must(
  await PortfolioCalculationService.calculate(portfolio, marketDataStore, options)
);
const elapsedMs = performance.now() - start;

const { updatedPortfolio, portfolioCalculationSummary } = result;
const metrics = updatedPortfolio.props.metrics!;

// === CALCULATION SUMMARY ===
console.log("=== CALCULATION SUMMARY ===");
console.log(`Positions priced : ${metrics.numberOfPositions}`);
console.log(`Formulas OK      : ${portfolioCalculationSummary.successful}`);
console.log(`Formulas failed  : ${portfolioCalculationSummary.failed}`);
if (portfolioCalculationSummary.failed > 0) {
  for (const [formulaId, reason] of portfolioCalculationSummary.failureReasons.entries()) {
    console.log(`  ${formulaId}: ${reason}`);
  }
}
console.log();

// === AGGREGATE METRICS ===
console.log("=== PORTFOLIO METRICS ===");
if (metrics.totalMarketValue) {
  console.log(
    `Total market value : ${metrics.totalMarketValue.amount.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })} ${metrics.totalMarketValue.currency.code}`
  );
}
if (metrics.portfolioDuration) {
  console.log(
    `Macaulay duration  : ${metrics.portfolioDuration.portfolioMacaulayDuration.toFixed(4)} yrs`
  );
  console.log(
    `Modified duration  : ${metrics.portfolioDuration.portfolioModifiedDuration.toFixed(4)}`
  );
  console.log(
    `Dollar duration    : ${metrics.portfolioDuration.portfolioDollarDuration.amount.toLocaleString(
      "en-US",
      { maximumFractionDigits: 2 }
    )} ${metrics.portfolioDuration.portfolioDollarDuration.currency.code}`
  );
}
if (metrics.portfolioDiscountRate) {
  console.log(
    `Avg discount rate  : ${(metrics.portfolioDiscountRate.asDecimal * 100).toFixed(4)}%`
  );
}
if (metrics.cashFlows) {
  console.log(
    `Aggregated flows   : ${metrics.cashFlows.cashFlows.length} dates across ${metrics.cashFlows.numberOfBonds} bonds`
  );
}
console.log();

// === SPEED ===
console.log("=== SPEED ===");
console.log(`Bonds priced       : ${BOND_COUNT.toLocaleString("en-US")}`);
console.log(`Wall-clock         : ${elapsedMs.toFixed(1)} ms`);
console.log(`Per bond           : ${(elapsedMs / BOND_COUNT).toFixed(4)} ms`);
console.log(
  `Throughput         : ${Math.round(BOND_COUNT / (elapsedMs / 1000)).toLocaleString("en-US")} bonds/sec`
);
