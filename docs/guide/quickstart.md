# Quickstart

## Install

```bash
npm install bond-analytics
```

The package ships ESM + CommonJS builds with bundled type declarations. It requires Node 18+ (or any modern bundler) and has **no runtime dependencies**.

## Price a bond from its market price

```ts
import {
  Bond, BondCalculationService,
  MarketDataStore, BondFormulaOptions,
  Currency, Money, Percentage, BondId, CreditRating, UTCDate,
} from "bond-analytics";

// every factory returns a Result<T> — no thrown exceptions
const must = <T>(r: { success: true; value: T } | { success: false; error: string }): T => {
  if (!r.success) throw new Error(r.error);
  return r.value;
};

const EUR = must(Currency.create("EUR"));
const id = must(BondId.create({ isin: "XS284124583" }));

const bond = Bond.create({
  id,
  name: "LITHUN 3.5 07/03/31",
  issueDate: must(UTCDate.fromString("2024-07-03")),
  maturityDate: must(UTCDate.fromString("2031-07-03")),
  issuer: "Republic of Lithuania",
  issuerCountry: "LT",
  bondCategory: "SOVEREIGN",
  issuerSector: "GOVERNMENT",
  issueCurrency: EUR,
  analyticalCurrency: EUR,
  faceValue: must(Money.create(1_000_000, EUR)),
  creditRating: must(CreditRating.create("A")),
  settlementDays: 2,
  dayCountConvention: "ACT_ACT",
  businessDayConvention: "MODIFIED_FOLLOWING",
  paymentCalendar: "EUREX",
  bondType: "FIXED",
  fixedRate: must(Percentage.fromDecimal(0.035)),
  frequency: 1,
});

// observed market price → implied yield
const marketDataStore = MarketDataStore.create([{
  asOfDate: must(UTCDate.fromString("2026-01-16")),
  bondPrice: [{ bondId: id, priceType: "clean", bid: must(Percentage.fromDecimal(1.022935)) }],
}]);

const options: BondFormulaOptions = {
  settlementDate: must(UTCDate.fromString("2026-01-20")),
  analysisDate: must(UTCDate.fromString("2026-01-16")),
  discountRate: { methods: ["implied_from_price"] },
  cashFlow: { includeInitialOutflow: true },
};

const { updatedBond } = must(
  await BondCalculationService.calculate(bond, marketDataStore, options)
);

const m = updatedBond.props.metrics!;
console.log(m.dirtyPrice!.asPercent);        // 104.2208
console.log(m.cleanPrice!.asPercent);        // 102.2935
console.log(m.accruedInterest!.accruedDays); // 201
console.log(m.duration!.modifiedDuration);   // 4.825
console.log(m.discountRate!.discountRate.asPercent); // 3.0341
```

Those numbers are pinned in the test suite against Bloomberg-computed reference values.

## The `Result<T>` pattern

Nothing throws for expected failures. Construction and calculation return:

```ts
type Result<T> =
  | { success: true;  value: T }
  | { success: false; error: string };
```

so error paths are visible in the types. The `must` helper above is the terse way to unwrap one when you want a throw at the boundary.

## Next steps

- [Methodology](./methodology) — the financial math behind every metric.
- [Architecture](./architecture) — how the engine is structured.
- [Examples](./examples) — ten runnable end-to-end scenarios.
- [API Reference](/api/) — every exported type and function.
