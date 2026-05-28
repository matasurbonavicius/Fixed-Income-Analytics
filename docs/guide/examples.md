# Examples

The repository ships ten runnable, end-to-end scenarios in [`examples/`](https://github.com/matasurbonavicius/Bond-Analytics/tree/main/examples). Each prices a real bond and prints the engine's output next to Bloomberg reference values.

Run any of them from the repo root:

```bash
npx tsx examples/bond.fixed.fromprice.demo.ts
```

All examples price the **same two bonds** — a fixed-rate `LITHUN 3.5 07/03/31` and a zero-coupon `LITHGB 0 03/03/28` — but each demonstrates a different entry in the discount-rate waterfall. Those two bonds are also the fixtures pinned in the [golden-value tests](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/application/bondCalculation.golden.test.ts).

| File | Instrument | Discount-rate method | Demonstrates |
|---|---|---|---|
| `bond.fixed.fromprice.demo.ts` | Fixed-rate | `implied_from_price` | Invert an observed market price to yield |
| `bond.fixed.manualRate.demo.ts` | Fixed-rate | `manual_rate` | Value at an analyst-supplied absolute rate |
| `bond.fixed.manualSpread.demo.ts` | Fixed-rate | `manual_spread` | Risk-free curve + analyst spread |
| `bond.fixed.officialRating.demo.ts` | Fixed-rate | `official_rating` | Curve + spread from the issuer's official rating |
| `bond.fixed.internalRating.demo.ts` | Fixed-rate | `internal_rating` | Curve + spread from an in-house rating |
| `bond.zero.fromprice.demo.ts` | Zero-coupon | `implied_from_price` | Implied yield of a zero from price |
| `bond.zero.manualRate.demo.ts` | Zero-coupon | `manual_rate` | Zero valued at a supplied rate |
| `bond.zero.manualSpread.demo.ts` | Zero-coupon | `manual_spread` | Zero with curve + spread |
| `bond.zero.officialRating.demo.ts` | Zero-coupon | `official_rating` | Zero priced off an official rating |
| `bond.zero.internalRating.demo.ts` | Zero-coupon | `internal_rating` | Zero priced off an internal rating |

See the [Methodology](./methodology#_5-discount-rate-yield-the-waterfall) for how the waterfall resolves a valuation rate.
