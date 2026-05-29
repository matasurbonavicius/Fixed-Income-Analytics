import { MarketDataStore } from "@domain/dataStructures";
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
import { Bond } from "@domain/entities";
import { BondCalculationService } from "@application/core";

// === CREATE MARKET DATA ===
// Create the bond ID
const bondIdResult = BondId.create({
  isin: "LT0000670051",
});
if (!bondIdResult.success) {
  throw new Error(bondIdResult.error);
}
const id = bondIdResult.value;

const marketDataStore = MarketDataStore.create([]);

// === CREATE CALCULATION OPTIONS ===
// Discount rate waterfall. for now only from price
const discountRateOptions: DiscountRateOptions = {
  methods: ["manual_rate"],
};

// Cashflow - include outflow (dirty price)
const cashFlowOptions: CashFlowOptions = {
  includeInitialOutflow: true,
};

// same as bloomberg's settlement date
const settlementDateResult = UTCDate.fromString("2026-01-20");
if (!settlementDateResult.success) {
  throw Error("date creation in demo error");
}
const settlementDate = settlementDateResult.value;

// Construct the options
const calculationOptions: BondFormulaOptions = {
  settlementDate,
  analysisDate: settlementDate,
  discountRate: discountRateOptions,
  cashFlow: cashFlowOptions,
};

// CREATE BOND ENTITY
// Currency creation
const eurResult = Currency.create("EUR");
if (!eurResult.success) {
  throw new Error(eurResult.error);
}
const issueCurrency = eurResult.value;
const analyticalCurrency = issueCurrency;

// Facevalue creation
const faceValueResult = Money.create(1_000_000, issueCurrency);
if (!faceValueResult.success) {
  throw new Error(faceValueResult.error);
}
const faceValue = faceValueResult.value;

// Credit rating creation
const creditRatingResult = CreditRating.create("A");
if (!creditRatingResult.success) {
  throw new Error(creditRatingResult.error);
}
const creditRating = creditRatingResult.value;

// Issue date
const issueDateResult = UTCDate.fromString("2021-03-03");
if (!issueDateResult.success) {
  throw Error("date creation in demo error");
}
const issueDate = issueDateResult.value;

// Maturity date
const maturityDateResult = UTCDate.fromString("2028-03-03");
if (!maturityDateResult.success) {
  throw Error("date creation in demo error");
}
const maturityDate = maturityDateResult.value;

// Manual discount rate
const manualRateResult = Percentage.fromDecimal(0.025998);
if (!manualRateResult.success) {
    throw Error("percentage creation in demo error");
}
const manualRate = manualRateResult.value;

// Bond entity creation
const lithuaniaBond = Bond.create({
  // IDENTIFIER
  id,

  // BASIC INFO
  name: "LITHGB 0 03/03/28",
  description: "Lithuania zero rate bond",

  // ISSUER INFO
  issueDate,
  issuer: "Republic of Lithuania",
  issuerCountry: "LT",

  // CATEGORIZATION
  bondCategory: "SOVEREIGN",
  issuerSector: "GOVERNMENT",

  // CURRENCIES
  issueCurrency,
  analyticalCurrency,

  // CORE TERMS
  faceValue,
  maturityDate,

  // TRADING INFO
  settlementDays: 2, // T+2
  dayCountConvention: "ACT_ACT",
  businessDayConvention: "MODIFIED_FOLLOWING",
  paymentCalendar: "EUREX",

  // Valuation method
  manualDiscountRate: manualRate,

  // CREDIT INFO
  creditRating: creditRating,

  // FIXED RATE BOND SPECIFIC
  bondType: "ZERO",
  frequency: 0, // Annual payments
});

// === RUN CALCULATION SERVICE ===
const calculationResult = await BondCalculationService.calculate(
  lithuaniaBond,
  marketDataStore,
  calculationOptions
);
if (!calculationResult.success) {
  throw new Error(calculationResult.error);
}
const { updatedBond, calculationSummary } = calculationResult.value;

// Print entire bond
// console.log(JSON.stringify(updatedBond, null, 2));
// console.log();
// console.log();

// Check calculation summary
console.log("=== CALCULATION SUMMARY ===");
console.log(`Successful: ${calculationSummary.successful}`);
console.log(`Failed: ${calculationSummary.failed}`);

if (calculationSummary.failed > 0) {
  console.log("\n=== FAILURES ===");
  for (const [
    formulaId,
    reason,
  ] of calculationSummary.failureReasons.entries()) {
    console.log(`${formulaId}: ${reason}`);
  }
}
console.log();

const metrics = updatedBond.props.metrics!;

// Dirty Price
console.log("Dirty Price");
if (metrics.dirtyPrice) {
  console.log(`Calculated: ${metrics.dirtyPrice.asPercent.toFixed(4)}%`);
}
console.log("Bloomberg: 94.71615%");
console.log();

// Clean Price
console.log("Clean Price");
if (metrics.cleanPrice) {
  console.log(`Calculated: ${metrics.cleanPrice.asPercent.toFixed(4)}%`);
}

console.log(`Bloomberg: 94.71615%%`);
console.log();

// Accrued Interest
console.log("Accrued Interest");
if (metrics.accruedInterest) {
  console.log(
    `Calculated: ${metrics.accruedInterest.amountMoney.amount.toFixed(
      4
    )}`
  );
}
console.log("Bloomberg: 0");
console.log();

// Duration
console.log("Duration");
if (metrics.duration) {
  if (metrics.duration.macaulayDuration !== undefined) {
    console.log(
      `Calculated Macaulay: ${metrics.duration.macaulayDuration.toFixed(4)}`
    );
  }
  if (metrics.duration.modifiedDuration !== undefined) {
    console.log(
      `Calculated Modified: ${metrics.duration.modifiedDuration.toFixed(4)}`
    );
  }
  if (metrics.duration.dollarDuration) {
    console.log(
      `Calculated Dollar: ${metrics.duration.dollarDuration.amount.toFixed(4)}`
    );
  }
  if (metrics.duration.convexity !== undefined) {
    console.log(
      `Calculated Convexity: ${metrics.duration.convexity.toFixed(4)}`
    );
  }
}
console.log("Bloomberg Modified: 2.061");
console.log();

// Discount Rate
console.log("Discount Rate");
if (metrics.discountRate) {
  const calcRate = metrics.discountRate.discountRate.asDecimal * 100;
  console.log(`Calculated: ${calcRate.toFixed(6)}%`);
  console.log(`Calculated: ${metrics.discountRate.methodUsed} Used`);
}
console.log("Bloomberg: 2.5998%");
console.log();
