// Consumer smoke-test: imports from the *published package* surface
// ("bond-analytics"), exactly as a downstream user would — no internal
// "@domain/..." path aliases. Run via `npm run smoke` from the repo root,
// which packs the tarball, installs it here, and executes this file.
//
// It prices the same fixed-rate bond as
// examples/bond.fixed.fromprice.demo.ts and checks the result against the
// Bloomberg reference so a broken/empty published surface fails loudly.

import {
  MarketDataStore,
  Percentage,
  BondId,
  Currency,
  Money,
  CreditRating,
  UTCDate,
  Bond,
  BondCalculationService,
} from "bond-analytics";

function unwrap(result, label) {
  if (!result.success) {
    throw new Error(`${label}: ${result.error}`);
  }
  return result.value;
}

const id = unwrap(BondId.create({ isin: "XS284124583" }), "BondId");
const cleanPrice = unwrap(Percentage.fromDecimal(1.022935), "cleanPrice");
const asOfDate = unwrap(UTCDate.fromString("2026-01-16"), "asOfDate");
const settlementDate = unwrap(UTCDate.fromString("2026-01-20"), "settlementDate");

const marketDataStore = MarketDataStore.create([
  {
    asOfDate,
    bondPrice: [{ bondId: id, priceType: "clean", bid: cleanPrice }],
  },
]);

const calculationOptions = {
  settlementDate,
  analysisDate: asOfDate,
  discountRate: { methods: ["implied_from_price"] },
  cashFlow: { includeInitialOutflow: true },
};

const issueCurrency = unwrap(Currency.create("EUR"), "Currency");
const faceValue = unwrap(Money.create(1_000_000, issueCurrency), "faceValue");
const fixedRate = unwrap(Percentage.fromDecimal(0.035), "fixedRate");
const creditRating = unwrap(CreditRating.create("A"), "CreditRating");
const issueDate = unwrap(UTCDate.fromString("2024-07-03"), "issueDate");
const maturityDate = unwrap(UTCDate.fromString("2031-07-03"), "maturityDate");

const bond = Bond.create({
  id,
  name: "LITHUN 3.5 07/03/31",
  description: "Lithuania fixed rate bond",
  issueDate,
  issuer: "Republic of Lithuania",
  issuerCountry: "LT",
  bondCategory: "SOVEREIGN",
  issuerSector: "GOVERNMENT",
  issueCurrency,
  analyticalCurrency: issueCurrency,
  faceValue,
  maturityDate,
  settlementDays: 2,
  dayCountConvention: "ACT_ACT",
  businessDayConvention: "MODIFIED_FOLLOWING",
  paymentCalendar: "EUREX",
  creditRating,
  bondType: "FIXED",
  fixedRate,
  frequency: 1,
});

const { updatedBond } = unwrap(
  await BondCalculationService.calculate(bond, marketDataStore, calculationOptions),
  "calculate"
);

const metrics = updatedBond.props.metrics;
const dirty = metrics?.dirtyPrice?.asPercent;

console.log("Imported from package: bond-analytics");
console.log(`Dirty price : ${dirty?.toFixed(4)}%  (Bloomberg 104.2208%)`);
console.log(`Clean price : ${metrics?.cleanPrice?.asPercent.toFixed(4)}%  (Bloomberg 102.2935%)`);

// Fail the process if the number is wrong, so the smoke test is a real gate.
if (dirty === undefined || Math.abs(dirty - 104.2208) > 0.01) {
  console.error("\nSMOKE TEST FAILED: dirty price does not match Bloomberg reference.");
  process.exit(1);
}
console.log("\nSmoke test passed.");
