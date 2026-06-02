/**
 * Spreads demo — the curve-relative spread family (Z / I / G).
 *
 * Same Lithuanian fixed-rate bond as bond.fixed.fromprice.demo.ts, but the
 * market snapshot now carries a EUR yield curve. The engine implies the yield
 * from the observed price as before, and additionally solves the Z-spread (the
 * parallel shift of the whole zero curve that reprices the bond) plus the
 * I-spread (yield minus the curve rate at the bond's life). The G-spread is
 * shown by supplying a separate government benchmark curve.
 *
 * Run: npx tsx examples/bond.fixed.spreads.demo.ts
 */
import { MarketData, MarketDataStore } from "@domain/dataStructures";
import {
  Percentage,
  BondId,
  Currency,
  Money,
  CreditRating,
  UTCDate,
  DiscountCurve,
} from "@domain/valueObjects";
import { BondFormulaOptions } from "@domain/specifications";
import {
  DiscountRateOptions,
  calculateSimpleSpreads,
  dayCountFraction,
} from "@domain/formulas";
import { Bond } from "@domain/entities";
import { BondCalculationService } from "@application/core";

// === IDENTIFIERS & MARKET DATA =============================================
const id = unwrap(BondId.create({ isin: "XS284124583" }));
const cleanPrice = unwrap(Percentage.fromDecimal(1.022935)); // 102.2935%
const asOfDate = unwrap(UTCDate.fromString("2026-01-16"));
const settlementDate = unwrap(UTCDate.fromString("2026-01-20")); // T+2

const EUR = unwrap(Currency.create("EUR"));

// A representative EUR zero curve spanning the bond's ~5.5y life.
const marketData: MarketData = {
  asOfDate,
  bondPrice: [{ bondId: id, priceType: "clean", bid: cleanPrice }],
  yieldCurve: [
    {
      currency: EUR,
      points: [
        { tenor: 1, rate: unwrap(Percentage.fromDecimal(0.024)) },
        { tenor: 2, rate: unwrap(Percentage.fromDecimal(0.0255)) },
        { tenor: 3, rate: unwrap(Percentage.fromDecimal(0.0265)) },
        { tenor: 5, rate: unwrap(Percentage.fromDecimal(0.028)) },
        { tenor: 7, rate: unwrap(Percentage.fromDecimal(0.029)) },
        { tenor: 10, rate: unwrap(Percentage.fromDecimal(0.03)) },
      ],
    },
  ],
};
const marketDataStore = MarketDataStore.create([marketData]);

// === OPTIONS ================================================================
const discountRate: DiscountRateOptions = { methods: ["implied_from_price"] };
const calculationOptions: BondFormulaOptions = {
  settlementDate,
  analysisDate: asOfDate,
  discountRate,
  cashFlow: { includeInitialOutflow: true },
};

// === BOND ENTITY ============================================================
const bond = Bond.create({
  id,
  name: "LITHUN 3.5 07/03/31",
  description: "Lithuania fixed rate bond",
  issueDate: unwrap(UTCDate.fromString("2024-07-03")),
  issuer: "Republic of Lithuania",
  issuerCountry: "LT",
  bondCategory: "SOVEREIGN",
  issuerSector: "GOVERNMENT",
  issueCurrency: EUR,
  analyticalCurrency: EUR,
  faceValue: unwrap(Money.create(1_000_000, EUR)),
  maturityDate: unwrap(UTCDate.fromString("2031-07-03")),
  settlementDays: 2,
  dayCountConvention: "ACT_ACT",
  businessDayConvention: "MODIFIED_FOLLOWING",
  paymentCalendar: "EUREX",
  creditRating: unwrap(CreditRating.create("A")),
  bondType: "FIXED",
  fixedRate: unwrap(Percentage.fromDecimal(0.035)),
  frequency: 1,
});

// === RUN ====================================================================
const calculationResult = await BondCalculationService.calculate(
  bond,
  marketDataStore,
  calculationOptions
);
if (!calculationResult.success) {
  throw new Error(calculationResult.error);
}
const { updatedBond, calculationSummary } = calculationResult.value;
const metrics = updatedBond.props.metrics!;

console.log("=== CALCULATION SUMMARY ===");
console.log(`Successful: ${calculationSummary.successful}`);
console.log(`Failed: ${calculationSummary.failed}`);
if (calculationSummary.failed > 0) {
  for (const [f, reason] of calculationSummary.failureReasons.entries()) {
    console.log(`  ${f}: ${reason}`);
  }
}
console.log();

console.log("Implied yield (from price)");
if (metrics.discountRate) {
  console.log(`  ${metrics.discountRate.discountRate.asPercent.toFixed(4)}%`);
}
console.log();

console.log("Spreads vs the EUR (swap) curve");
if (metrics.spreads) {
  console.log(`  Z-spread: ${bps(metrics.spreads.zSpread)} bps`);
  console.log(`  I-spread: ${bps(metrics.spreads.iSpread)} bps`);
}
console.log();

// === G-SPREAD vs a GOVERNMENT BENCHMARK CURVE ==============================
//
// G-spread needs a *second*, government benchmark curve distinct from the main
// discounting/swap curve. The engine surfaces Z- and I-spread automatically;
// here we supply a govvie curve and call the domain math directly to show the
// G-spread number. A typical EUR govvie (e.g. Bund) curve sits a touch *below*
// the swap curve, so G-spread comes out a little wider than I-spread.
const govvieCurve = unwrap(
  DiscountCurve.fromZeroRates([
    { tenor: 1, rate: unwrap(Percentage.fromDecimal(0.022)) },
    { tenor: 2, rate: unwrap(Percentage.fromDecimal(0.0235)) },
    { tenor: 3, rate: unwrap(Percentage.fromDecimal(0.0245)) },
    { tenor: 5, rate: unwrap(Percentage.fromDecimal(0.026)) },
    { tenor: 7, rate: unwrap(Percentage.fromDecimal(0.027)) },
    { tenor: 10, rate: unwrap(Percentage.fromDecimal(0.028)) },
  ])
);

// Rebuild the swap curve as a DiscountCurve for the I-spread leg, and use the
// engine's settlement date + the bond's day count for the bond's life.
const swapCurve = unwrap(
  DiscountCurve.fromZeroRates(marketData.yieldCurve![0].points)
);
const yearsToMaturity = dayCountFraction(
  settlementDate,
  bond.props.maturityDate,
  bond.props.dayCountConvention
);
const bondYield = metrics.discountRate!.discountRate;

const spreads = unwrap(
  calculateSimpleSpreads({ bondYield, yearsToMaturity, curve: swapCurve, govvieCurve })
);

console.log("Spreads vs a government benchmark curve");
console.log(`  I-spread (vs swap):       ${bps(spreads.iSpread)} bps`);
console.log(`  G-spread (vs government): ${bps(spreads.gSpread!)} bps`);

/** A Percentage rendered in basis points to 2 dp. */
function bps(p: Percentage): string {
  return (p.asPercent * 100).toFixed(2);
}

/** Unwrap a Result, throwing on failure — keeps the demo terse. */
function unwrap<T>(result: { success: true; value: T } | { success: false; error: string }): T {
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.value;
}
