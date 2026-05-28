/**
 * Canonical bond fixtures used across the test suite.
 *
 * Both bonds are real Lithuanian government issues whose metrics were
 * independently computed in Bloomberg; the expected values in
 * {@link FIXED_GOLDEN} and {@link ZERO_GOLDEN} are those Bloomberg figures.
 * They double as the inputs for the runnable demos in `examples/`.
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
import type { DiscountRateOptions, CashFlowOptions } from "@domain/formulas";
import { Bond } from "@domain/entities";
import { unwrap } from "../helpers/result";

const EUR = unwrap(Currency.create("EUR"));

export interface BondFixture {
  bond: Bond;
  marketDataStore: MarketDataStore;
  options: BondFormulaOptions;
}

/** Shared calculation options: settle T+2 at 2026-01-20, price-implied yield. */
function makeOptions(asOfDate: UTCDate, settlementDate: UTCDate): BondFormulaOptions {
  const discountRate: DiscountRateOptions = { methods: ["implied_from_price"] };
  const cashFlow: CashFlowOptions = { includeInitialOutflow: true };
  return { settlementDate, analysisDate: asOfDate, discountRate, cashFlow };
}

/**
 * LITHUN 3.5 07/03/31 — EUR 1,000,000 face, 3.5% annual coupon, ACT/ACT,
 * priced at 102.2935% clean as of 2026-01-16, settling 2026-01-20.
 */
export function makeFixedRateBond(): BondFixture {
  const id = unwrap(BondId.create({ isin: "XS284124583" }));
  const cleanPrice = unwrap(Percentage.fromDecimal(1.022935));
  const asOfDate = unwrap(UTCDate.fromString("2026-01-16"));
  const settlementDate = unwrap(UTCDate.fromString("2026-01-20"));

  const marketData: MarketData = {
    asOfDate,
    bondPrice: [{ bondId: id, priceType: "clean", bid: cleanPrice }],
  };
  const marketDataStore = MarketDataStore.create([marketData]);

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

  return { bond, marketDataStore, options: makeOptions(asOfDate, settlementDate) };
}

/**
 * LITHGB 0 03/03/28 — EUR 1,000,000 face, zero coupon, ACT/ACT,
 * priced at 94.71615% as of 2026-01-16, settling 2026-01-20.
 */
export function makeZeroCouponBond(): BondFixture {
  const id = unwrap(BondId.create({ isin: "LT0000670051" }));
  const cleanPrice = unwrap(Percentage.fromDecimal(0.9471615));
  const asOfDate = unwrap(UTCDate.fromString("2026-01-16"));
  const settlementDate = unwrap(UTCDate.fromString("2026-01-20"));

  const marketData: MarketData = {
    asOfDate,
    bondPrice: [{ bondId: id, priceType: "clean", bid: cleanPrice }],
  };
  const marketDataStore = MarketDataStore.create([marketData]);

  const bond = Bond.create({
    id,
    name: "LITHGB 0 03/03/28",
    description: "Lithuania zero rate bond",
    issueDate: unwrap(UTCDate.fromString("2021-03-03")),
    issuer: "Republic of Lithuania",
    issuerCountry: "LT",
    bondCategory: "SOVEREIGN",
    issuerSector: "GOVERNMENT",
    issueCurrency: EUR,
    analyticalCurrency: EUR,
    faceValue: unwrap(Money.create(1_000_000, EUR)),
    maturityDate: unwrap(UTCDate.fromString("2028-03-03")),
    settlementDays: 2,
    dayCountConvention: "ACT_ACT",
    businessDayConvention: "MODIFIED_FOLLOWING",
    paymentCalendar: "EUREX",
    creditRating: unwrap(CreditRating.create("A")),
    bondType: "ZERO",
    frequency: 0,
  });

  return { bond, marketDataStore, options: makeOptions(asOfDate, settlementDate) };
}

/** Bloomberg-computed reference metrics for the fixed-rate fixture. */
export const FIXED_GOLDEN = {
  dirtyPricePercent: 104.2208,
  cleanPricePercent: 102.2935,
  accruedInterestAmount: 19273.97,
  accruedDays: 201,
  modifiedDuration: 4.825,
  discountRatePercent: 3.034080,
} as const;

/** Bloomberg-computed reference metrics for the zero-coupon fixture. */
export const ZERO_GOLDEN = {
  cleanPricePercent: 94.71615,
  accruedInterestAmount: 0,
  modifiedDuration: 2.061,
  discountRatePercent: 2.5998,
} as const;
