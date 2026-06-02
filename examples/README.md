# Examples

Runnable, self-contained scripts that exercise the Fixed Income Analytics pricing engine end to end. Most scripts build a `Bond` entity and a `MarketDataStore`, run `BondCalculationService.calculate`, and print the resulting metrics (dirty/clean price, accrued interest, duration, discount rate) next to **Bloomberg reference values** for easy comparison. The portfolio script instead aggregates many bonds through `PortfolioCalculationService.calculate`.

## Running an example

From the repository root:

```bash
npx tsx examples/<file>.ts
```

For example:

```bash
npx tsx examples/bond.fixed.fromprice.demo.ts
```

## What each example demonstrates

All ten scripts price the **same two bonds** — a fixed-rate `LITHUN 3.5 07/03/31` and a zero-coupon `LITHGB 0 03/03/28`. The only thing that varies is the `discountRate.methods` waterfall entry, i.e. how the discount rate is sourced.

| File | Instrument | Discount-rate method | Description |
| --- | --- | --- | --- |
| `bond.fixed.fromprice.demo.ts` | Fixed | `implied_from_price` | Solves the discount rate implied by an observed clean market price. |
| `bond.fixed.manualRate.demo.ts` | Fixed | `manual_rate` | Prices off an explicitly supplied discount rate. |
| `bond.fixed.manualSpread.demo.ts` | Fixed | `manual_spread` | Adds a manual spread (bps) on top of a yield curve. |
| `bond.fixed.officialRating.demo.ts` | Fixed | `official_rating` | Derives the spread from the bond's official credit rating. |
| `bond.fixed.internalRating.demo.ts` | Fixed | `internal_rating` | Derives the spread from an internal rating-to-spread mapping. |
| `bond.zero.fromprice.demo.ts` | Zero | `implied_from_price` | Solves the discount rate implied by an observed clean market price. |
| `bond.zero.manualRate.demo.ts` | Zero | `manual_rate` | Prices off an explicitly supplied discount rate. |
| `bond.zero.manualSpread.demo.ts` | Zero | `manual_spread` | Adds a manual spread (bps) on top of a yield curve. |
| `bond.zero.officialRating.demo.ts` | Zero | `official_rating` | Derives the spread from the bond's official credit rating. |
| `bond.zero.internalRating.demo.ts` | Zero | `internal_rating` | Derives the spread from an internal rating-to-spread mapping. |

## Portfolio

`portfolio.demo.ts` builds a **1,000-bond portfolio** (an even mix of the two fixtures, each cloned under a unique ID and a varied holding size), prices the whole book in a single `PortfolioCalculationService.calculate` call, and prints the aggregate metrics — total market value, market-value-weighted Macaulay/modified/dollar duration, weighted average discount rate, and the aggregated cash-flow schedule.

It also **measures speed**: wall-clock for the full run, time per bond, and throughput in bonds/sec. On a typical laptop the 1,000-bond run completes in well under a second.

```bash
npx tsx examples/portfolio.demo.ts
```

## Reference values

The Bloomberg figures printed alongside the engine output are the ground truth. The two bonds used here are the same fixtures pinned in the golden-value tests at [`tests/application/bondCalculation.golden.test.ts`](../tests/application/bondCalculation.golden.test.ts), so the numbers these scripts print should match what the test suite asserts.
