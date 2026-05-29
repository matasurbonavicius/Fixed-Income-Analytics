# Examples

Runnable, self-contained scripts that exercise the Fixed Income Analytics pricing engine end to end. Each script builds a `Bond` entity and a `MarketDataStore`, runs `BondCalculationService.calculate`, and prints the resulting metrics (dirty/clean price, accrued interest, duration, discount rate) next to **Bloomberg reference values** for easy comparison.

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

## Reference values

The Bloomberg figures printed alongside the engine output are the ground truth. The two bonds used here are the same fixtures pinned in the golden-value tests at [`tests/application/bondCalculation.golden.test.ts`](../tests/application/bondCalculation.golden.test.ts), so the numbers these scripts print should match what the test suite asserts.
