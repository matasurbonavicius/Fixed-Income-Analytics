# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-06-02

First release published to npm. Promotes the initial feature set to a stable,
semver-governed 1.x API. No functional changes from 0.1.0.

## [0.1.0] - 2026-05-28

Initial public release.

### Added

- Fixed-rate and zero-coupon bond modelling.
- Per-bond metrics: accrued interest, clean/dirty price, cash-flow schedule,
  discount rate (yield) via a configurable waterfall, and Macaulay/modified/dollar
  duration.
- Portfolio metrics: total market value, portfolio duration, aggregated cash flows,
  market-value-weighted average yield, and multi-currency conversion.
- Day-count conventions (ACT/ACT, ACT/360, ACT/365, the 30/360 family, and more),
  business-day adjustment, and QuantLib-generated holiday calendars.
- `CalculationEngine` with a formula dependency graph, result caching, and
  circular-dependency detection.
- Zero runtime dependencies; ESM + CommonJS builds with bundled type declarations.
- 307 tests including Bloomberg-pinned golden values and price/yield round-trips.

[Unreleased]: https://github.com/matasurbonavicius/Bond-Analytics/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/matasurbonavicius/Bond-Analytics/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/matasurbonavicius/Bond-Analytics/releases/tag/v0.1.0
