# Bond Analytics

A **dependency-free TypeScript engine for fixed-income analytics** — bond pricing, yield, accrued interest, duration, and portfolio-level metrics, computed across the day-count conventions and financial calendars used in real markets.

[![CI](https://github.com/matasurbonavicius/Bond-Analytics/actions/workflows/ci.yml/badge.svg)](https://github.com/matasurbonavicius/Bond-Analytics/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
![Runtime dependencies: 0](https://img.shields.io/badge/runtime%20deps-0-brightgreen)
![Types: included](https://img.shields.io/badge/types-included-blue)

```ts
import { BondCalculationService, Bond, Money, Percentage, Currency, UTCDate } from "bond-analytics";

const { updatedBond } = unwrap(
  await BondCalculationService.calculate(bond, marketDataStore, options)
);

updatedBond.props.metrics.dirtyPrice.asPercent;          // 104.2208
updatedBond.props.metrics.duration.modifiedDuration;     // 4.825
updatedBond.props.metrics.discountRate.discountRate.asPercent; // 3.0341
```

Those numbers are not illustrative — they are pinned in the test suite against **Bloomberg-computed reference values** for real Lithuanian government bonds (see [`tests/application/bondCalculation.golden.test.ts`](./tests/application/bondCalculation.golden.test.ts)).

---

## Why this exists

Most open-source bond math is either a thin YTM helper or a heavyweight wrapper around a C++ library. This engine sits in between: a **self-contained, strongly-typed, domain-driven** implementation of the calculations a fixed-income desk actually needs — with no native bindings, no framework, and **zero runtime dependencies**.

It is the calculation core extracted from a larger bond-analytics platform, published as a standalone library.

## Features

**Instruments**
- Fixed-rate bullet bonds and zero-coupon bonds
- Sovereign, corporate, municipal, agency, supranational, covered, MBS/ABS, convertible categories

**Per-bond metrics**
- **Accrued interest** (with exact accrued-day counting)
- **Clean & dirty price**
- **Cash-flow schedule** (coupons + principal, optional purchase outflow)
- **Discount rate / yield** via a configurable waterfall:
  `implied_from_price → official_rating → internal_rating → manual_spread → manual_rate`
- **Duration** — Macaulay, modified, and dollar duration

**Portfolio metrics**
- Total market value, portfolio Macaulay/modified/dollar duration
- Aggregated cash-flow schedule and market-value-weighted average yield
- **Multi-currency** conversion via supplied FX rates

**Market conventions**
- **Day count:** `ACT/ACT`, `ACT/365`, `ACT/360`, `ACT/364`, `ACT/366`, `ACT/ACT (AFB)`, `NL/365`, `30/360 (US/NASD/EU)`, `30/366`, `1/1`
- **Business-day adjustment:** `FOLLOWING`, `MODIFIED_FOLLOWING`, `PRECEDING`, `MODIFIED_PRECEDING`, `UNADJUSTED`
- **Holiday calendars:** NYSE, US Government Securities, SOFR, TARGET (EUR), LSE, EUREX, TSE, weekend-only — generated from [QuantLib](https://www.quantlib.org/) (see [`scripts/generate-calendars.py`](./scripts/generate-calendars.py))

## Install

```bash
npm install bond-analytics
```

Ships ESM + CommonJS builds with bundled type declarations. Requires Node 18+ (or any modern bundler).

## Quickstart

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

const { updatedBond, calculationSummary } = must(
  await BondCalculationService.calculate(bond, marketDataStore, options)
);

const m = updatedBond.props.metrics!;
console.log(m.dirtyPrice!.asPercent);        // 104.2208
console.log(m.cleanPrice!.asPercent);        // 102.2935
console.log(m.accruedInterest!.accruedDays); // 201
console.log(m.duration!.modifiedDuration);   // 4.825
```

Ten runnable end-to-end scenarios (fixed & zero, each across all five discount-rate methods) live in [`examples/`](./examples). Run one with:

```bash
npx tsx examples/bond.fixed.fromprice.demo.ts
```

## Architecture at a glance

```
src/
├── domain/         pure financial model — no I/O, no framework
│   ├── valueObjects/   Money · Percentage · Currency · CreditRating · UTCDate · BondId
│   ├── entities/       Bond · Portfolio
│   ├── dataStructures/ MarketData · MarketDataStore (yield curves, FX, spreads, prices)
│   ├── formulas/       the math: accrued interest, prices, yield solver, duration,
│   │                   day-count conventions, business-day & schedule utilities
│   ├── specifications/ calculation options (settlement, method waterfalls)
│   └── shared/         Result<T> railway-oriented error handling
├── application/    orchestration over the domain
│   ├── core/           CalculationEngine (formula DAG + caching) and services
│   ├── formulas/       formula registry wiring math into the engine
│   └── calculations/   (de)serialization of entities
└── calendars/      holiday data + types (generated from QuantLib)
```

The dependency rule is strict and one-directional: `application → domain`, and `domain` depends on nothing. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

The financial methodology — pricing identities, the yield solver, day-count math, duration — is documented in [`docs/METHODOLOGY.md`](./docs/METHODOLOGY.md).

## Design principles

- **Zero runtime dependencies.** All date and money arithmetic is implemented in first-class value objects.
- **No exceptions for expected failures.** Every fallible operation returns a `Result<T>`; invalid input is a value, not a throw.
- **Immutable value objects.** `Money`, `Percentage`, `UTCDate` etc. are validated at construction and never mutated.
- **The domain is framework-agnostic.** It can be dropped into a server, a worker, a CLI, or a browser unchanged.

## Development

```bash
npm install
npm run typecheck     # tsc --noEmit
npm test              # vitest (175 tests)
npm run test:coverage
npm run build         # tsup → ESM + CJS + .d.ts
```

## License

[Apache-2.0](./LICENSE) © Matas Urbonavičius
