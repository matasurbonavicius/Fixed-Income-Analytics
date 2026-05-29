# Design decisions

The [Methodology](./methodology) covers *what* the engine computes and the [Architecture](./architecture) covers *how* the code is laid out. This page covers **why** - the deliberate choices that shaped the library, and the trade-offs each one accepts. If you are evaluating whether this fits your stack, or wondering why something isn't done the "obvious" way, start here.

---

## Why zero runtime dependencies

Fixed-income math has a gravitational pull toward heavyweight tooling - most serious implementations are bindings around QuantLib or a similar C++ core. That buys breadth, but it costs you native builds, platform-specific binaries, a version-coupling headache, and a hard "no" the moment you want to run in a browser, an edge worker, or a locked-down serverless runtime.

This engine takes the opposite bet: **implement the calculations a desk actually uses, in plain TypeScript, and depend on nothing at runtime.** All date and money arithmetic lives in first-class value objects (§ value objects below) rather than a date library, so there is no transitive dependency surface at all.

**The trade-off we accept:** we don't get QuantLib's exhaustive instrument coverage for free. The scope is intentionally fixed-rate and zero-coupon bonds plus portfolio aggregation - the 80% that most teams need - rather than every exotic. In exchange the package drops unchanged into a server, a worker, a CLI, or a browser, installs in one step, and never breaks on a native-build mismatch.

---

## Why `Result<T>` instead of exceptions

Every fallible operation - constructing a value object, pricing a bond, solving for yield - returns

```ts
type Result<T> =
  | { success: true;  value: T }
  | { success: false; error: string };
```

rather than throwing. This is railway-oriented error handling, and the reasoning is that **in financial calculation, "this input can't be priced" is an expected outcome, not an exceptional one.** Market data is missing, a yield doesn't converge, a currency is mismatched - these happen constantly in normal operation. Modeling them as thrown exceptions means every caller has to remember to wrap things in `try/catch`, and a forgotten one fails silently or crashes a batch.

Making failure a *value* puts the error branch in the type signature, so the compiler forces every caller to acknowledge it. A batch calculation over a thousand bonds can collect the failures and keep going instead of aborting on the first bad input.

**The trade-off we accept:** call sites are more verbose - you unwrap a `Result` instead of writing a bare expression. The [Quickstart](/guide/quickstart) shows a one-line `must()` helper for the boundary cases where you genuinely do want to throw. We consider the explicitness worth it: error paths that are visible in the types don't get forgotten.

---

## Why first-class value objects (no primitive obsession)

`Money`, `Percentage`, `Currency`, `CurrencyPair`, `CreditRating`, `BondId`, and `UTCDate` are real types, not `number` and `string` aliases. They are **immutable and validated at construction**, so an invalid value can never exist past the point it's created.

The motivating bugs are mundane and expensive:

- **The ×100 bug.** Is `0.035` a rate of 3.5% or 0.035%? `Percentage` carries a decimal internally and exposes both `asDecimal` and `asPercent`, so the ambiguity is gone - you ask for the representation you want by name.
- **Currency mixing.** `Money` arithmetic *refuses* to add EUR to USD. The mistake becomes a compile-time/`Result` failure instead of a silently wrong number.
- **Date arithmetic drift.** `UTCDate` is anchored in UTC with day-count-friendly arithmetic, sidestepping the timezone and DST traps that make naive `Date` math wrong by a day at period boundaries - which, in accrued-interest land, is a real money error.

**The trade-off we accept:** more ceremony to get data *into* the engine (you construct a `Money` rather than passing a number). In return, an entire class of unit and sign errors simply cannot occur inside the calculations.

---

## Why a dependency-graph calculation engine

A bond's metrics aren't independent: clean price needs accrued interest; duration needs both the cash flows and the discount rate; the discount rate may itself come from inverting a price. Rather than hand-wire that ordering in each service, the `CalculationEngine` models the metrics as a **directed acyclic graph of formulas** and:

- resolves execution order topologically from each formula's declared dependencies,
- **caches** each formula's result within a run, so a shared input (e.g. the cash-flow schedule) is computed once and reused,
- **detects circular dependencies** and returns them as a `Result` failure instead of recursing into a stack overflow,
- collects a per-run `EngineSummary` - what succeeded, what failed and why, and timing.

The payoff is extensibility: **adding a new metric is "write the pure math, declare its dependencies, register it"** - the engine schedules it automatically, in the right order, with caching, for free. You never touch the orchestration.

**The trade-off we accept:** a graph engine is more machinery than a straight-line script for two or three metrics. It earns its keep as the metric set grows and the dependency web thickens, which is exactly the direction a fixed-income library tends to move.

---

## Why pure functions for the math, orchestration only at the edges

The formulas in `domain/formulas` are **pure functions** - explicit typed inputs, no side effects, no I/O, no clock. All the "wiring" (reading market data, assembling the engine, mutating nothing) lives in the application layer. This is what makes the math **referentially transparent and independently testable**: most of the test suite exercises the formulas directly, without constructing the engine at all, and the same input always yields the same output. It's also what lets the property/invariant tests (price→yield→price round-trips, par/premium/discount relationships) prove correctness without any external reference values.

---

## Why QuantLib-generated *static* calendars

Holiday calendars (NYSE, US Government Securities, SOFR, TARGET, LSE, EUREX, TSE) are not computed at runtime and are not pulled from a service. They are **generated ahead of time from [QuantLib](https://www.quantlib.org/)** by `scripts/generate-calendars.py` into a static JSON snapshot that ships with the package.

This is the bridge between two goals that otherwise conflict: we want **QuantLib's authoritative, battle-tested holiday data**, but we refuse a native runtime dependency. Generating a snapshot offline gives us both - the data is correct because it came from QuantLib, and the runtime stays pure JSON with zero dependencies. Years outside the generated range fall back to weekend-only, which is explicit and predictable rather than silently wrong.

**The trade-off we accept:** the calendar data is a point-in-time snapshot, so newly announced holidays or extended date ranges require regenerating it. For a deterministic valuation engine that's a feature, not a bug - the same code values the same bond identically today and next year.

---

## Why golden values *and* invariants in the test suite

Correctness is pinned two ways, on purpose:

- **Golden-value tests** anchor end-to-end output to Bloomberg figures for two real government bonds - the strongest possible "is this actually right" check, against the reference the market uses.
- **Property / invariant tests** prove relationships that must hold regardless of any external number: a price fed through the yield solver and back must recover the price to better than `1e-6`; a bond yields par when priced at its coupon, a premium below it, a discount above it; accrual is monotonic within a period; serialization round-trips.

Golden values catch "we implemented the wrong formula." Invariants catch "we implemented a formula that's wrong in a way Bloomberg happened not to exercise." One documented sub-basis-point gap (the zero-coupon implied yield, ~0.3 bp from Bloomberg) is held to an explicit 0.5 bp tolerance rather than masked by a loose bound - see the [Methodology](./methodology#a-note-on-precision-and-reference-values) for why.

---

Continue to the [API Reference](/api/) for the exported surface, or back to the [Architecture](./architecture) for how these decisions are organized in code.
