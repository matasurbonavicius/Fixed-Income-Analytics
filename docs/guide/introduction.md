# Introduction

**Fixed Income Analytics** is a dependency-free TypeScript engine for fixed-income analytics — bond pricing, yield, accrued interest, duration, and portfolio-level metrics, computed across the day-count conventions and financial calendars used in real markets.

It is the calculation core extracted from a larger fixed-income analytics platform, published as a standalone library.

## Why it exists

Most open-source bond math is either a thin yield-to-maturity helper or a heavyweight wrapper around a C++ library. This engine sits in between: a **self-contained, strongly-typed, domain-driven** implementation of the calculations a fixed-income desk actually needs - with no native bindings, no framework, and **zero runtime dependencies**.

## What it computes

**Instruments**
- Fixed-rate bullet bonds and zero-coupon bonds
- Sovereign, corporate, municipal, agency, supranational, covered, MBS/ABS, convertible categories

**Per-bond metrics**
- Accrued interest (with exact accrued-day counting)
- Clean and dirty price
- Cash-flow schedule (coupons + principal, optional purchase outflow)
- Discount rate / yield via a configurable waterfall
- Duration - Macaulay, modified, and dollar duration

**Portfolio metrics**
- Total market value, portfolio Macaulay/modified/dollar duration
- Aggregated cash-flow schedule and market-value-weighted average yield
- Multi-currency conversion via supplied FX rates

## Design principles

- **Zero runtime dependencies.** All date and money arithmetic is implemented in first-class value objects.
- **No exceptions for expected failures.** Every fallible operation returns a `Result<T>`; invalid input is a value, not a throw.
- **Immutable value objects.** `Money`, `Percentage`, `UTCDate` and friends are validated at construction and never mutated.
- **The domain is framework-agnostic.** It runs unchanged in a server, a worker, a CLI, or a browser.

Continue to the [Quickstart](./quickstart) to price your first bond, read the [Concepts](/concepts/methodology) section for the financial math and the reasoning behind the design, or browse the [API Reference](/api/).
