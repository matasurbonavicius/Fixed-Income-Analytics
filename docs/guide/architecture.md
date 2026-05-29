# Architecture

The engine is organised as a small **domain-driven design (DDD)** codebase with a strict dependency rule. This document explains the layers, the calculation engine, and the conventions that keep the core pure.

## Layers and the dependency rule

```
┌─────────────────────────────────────────────┐
│ application/   orchestration                  │
│   core/ services + CalculationEngine          │
│   formulas/ formula registry                  │
│   calculations/ (de)serialization             │
└───────────────────────┬───────────────────────┘
                        │  depends on
                        ▼
┌─────────────────────────────────────────────┐
│ domain/        pure financial model           │
│   valueObjects · entities · dataStructures    │
│   formulas · specifications · shared · i18n   │
└─────────────────────────────────────────────┘
                        │  depends on
                        ▼
┌─────────────────────────────────────────────┐
│ calendars/     static holiday data + types    │
└─────────────────────────────────────────────┘
```

**The rule:** dependencies point inward only. `application` may import `domain`; `domain` imports nothing but `calendars` (a leaf of static data and types). There are no imports of any framework, runtime, database, network, or UI library anywhere in `src/` — which is what makes the package **zero-dependency** and droppable into any JavaScript environment.

## The domain layer

### Value objects (`domain/valueObjects`)

Small, immutable, self-validating types that replace primitives:

- **`Money`** — amount + `Currency`, with arithmetic that refuses to mix currencies.
- **`Percentage`** — carries a decimal and exposes both `asDecimal` and `asPercent`, removing an entire class of ×100 bugs.
- **`Currency`**, **`CurrencyPair`**, **`CreditRating`**, **`BondId`**, **`UTCDate`** (a UTC-anchored date with day-count-friendly arithmetic).

Every constructor returns a `Result<T>` (see below), so an invalid value can never exist.

### Entities (`domain/entities`)

- **`Bond`** — identity + terms (dates, coupon, day-count, calendar, rating) and a slot for computed `metrics`.
- **`Portfolio`** — a set of `{ bond, quantity }` positions in a base currency.

### Data structures (`domain/dataStructures`)

`MarketData` and `MarketDataStore` hold the inputs a calculation reads: yield curves, FX rates, credit spreads (by rating), and observed bond prices — indexed by as-of date with controlled fallback.

### Formulas (`domain/formulas`)

The mathematics, written as **pure functions** with explicit typed inputs and no side effects: accrued interest, cash flows, clean/dirty price, the yield solver, duration, plus the day-count, business-day, and schedule utilities. Each formula has `*.math.fixed.ts` / `*.math.zero.ts` variants and a co-located validator. These functions are independently testable without constructing the engine — most of the test suite exercises them directly.

### Shared — `Result<T>`

The whole codebase uses railway-oriented error handling instead of exceptions:

```ts
type Result<T> =
  | { success: true;  value: T }
  | { success: false; error: string };
```

Expected failures (bad input, missing market data, non-convergence) are **values**, not throws. Callers must acknowledge the failure branch, which makes error paths visible in the types.

## The application layer

### CalculationEngine (`application/core`)

A bond's metrics form a dependency graph: clean price needs accrued interest; duration needs the cash flows and the discount rate; the discount rate may itself come from inverting a price. The `CalculationEngine` models this as a **directed acyclic graph of formulas** and:

- resolves execution order from declared dependencies (topological),
- **caches** each formula's result within a run so shared inputs are computed once,
- **detects circular dependencies** and surfaces them as a `Result` failure rather than recursing,
- collects a per-run `EngineSummary` (successes, failures with reasons, timing).

### Services

Thin entry points that assemble the engine for a use case:

- **`BondCalculationService.calculate(bond, marketDataStore, options)`**
- **`BondsCalculationService`** — batch over many bonds.
- **`PortfolioCalculationService.calculate(portfolio, …)`** — runs per-bond calculations, then the portfolio-level aggregations and FX conversion.

Each returns a `Result` carrying the updated entity and a calculation summary; the input entity is never mutated.

### Formula registry (`application/formulas`)

Wraps each pure domain formula in a small adapter that declares its dependencies and registers it with the engine (`ALL_BOND_FORMULAS`, `ALL_PORTFOLIO_FORMULAS`). Adding a new metric is: write the pure math in `domain/formulas`, wrap it here, declare its dependencies — the engine schedules it automatically.

### Serialization (`application/calculations`)

`serialize*` / `hydrate*` convert entities and value objects to and from plain JSON so results can cross a process or network boundary and be reconstructed losslessly (round-trips are tested in [`serialize.test.ts`](https://github.com/matasurbonavicius/Fixed-Income-Analytics/blob/main/tests/application/serialize.test.ts)).

## Conventions that keep it clean

- **Immutability everywhere.** Calculations produce new objects; nothing is mutated in place.
- **No primitive obsession.** Money, rates, and dates are types, not `number`s.
- **Pure core, orchestrated edges.** All math is referentially transparent; the only "wiring" lives in the application layer.
- **Path aliases** (`@domain`, `@application`, `@calendars`) are resolved at build time by `tsup`, so the published output contains no alias machinery.

## Testing strategy

- **Golden-value tests** pin end-to-end output to Bloomberg figures for real bonds.
- **Property/invariant tests** prove correctness without external constants: price→yield→price round-trips, par/premium/discount relationships, monotonic accrual, serialization round-trips, portfolio bounds.
- **Convention tests** lock day-count and business-day edge cases (30/360 variants, month-boundary roll-back, real holidays).

See [`METHODOLOGY.md`](./methodology) for the financial math itself.
