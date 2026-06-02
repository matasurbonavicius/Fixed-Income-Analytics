# Methodology

This document describes the financial mathematics the engine implements and the conventions it follows. It is meant to be read alongside the source in [`src/domain/formulas/`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/src/domain/formulas).

All calculations are expressed in terms of a **settlement date** (when cash and title change hands) and an **analysis date** (the as-of date of the market data). Prices are quoted per 100 of face (the engine carries them internally as decimal fractions on a `Percentage` value object).

---

## 1. Day-count conventions

Every time-weighted quantity - accrued interest, discounting, duration - depends on how the fraction of a year between two dates is measured. The engine implements the conventions in [`utilities/dayCountConventions.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/src/domain/formulas/utilities/dayCountConventions.ts):

| Convention | Year fraction between `d1` and `d2` |
|---|---|
| `ACT_ACT` | actual days ÷ actual days in the period's year(s) (ISDA) |
| `ACT_ACT_AFB` | actual days ÷ 365 or 366 (AFB) |
| `ACT_365` | actual days ÷ 365 |
| `ACT_360` | actual days ÷ 360 (money-market) |
| `ACT_364`, `ACT_366` | actual days ÷ 364 / 366 |
| `NL_365` | actual days excluding leap day ÷ 365 |
| `30_360_US` / `30_360_NASD` | `360(Y₂−Y₁)+30(M₂−M₁)+(D₂−D₁)` ÷ 360, US day rules |
| `30_360_EU` | as above, European (30E) day rules |
| `30_366` | 30/360-style numerator over a 366 year |
| `1_1` | one period = 1.0 (counts whole periods) |

The 30/360 family differs only in how the 31st (and, for US, end-of-February) is rolled to 30 before the arithmetic. The test suite ([`dayCountConventions.test.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/domain/formulas/utilities/dayCountConventions.test.ts)) pins the variant-distinguishing cases.

---

## 2. Accrued interest

For a fixed-rate bond, accrued interest between the last coupon date `t₀` and settlement `t_s` within a coupon period ending at `t₁` is

```
AI = FaceValue × CouponRate × DCF(t₀, t_s)
```

where `DCF` is the day-count fraction for the bond's convention. The engine reports both the money amount and the accrued-day count, and resets AI to zero on each coupon date.

A **zero-coupon** bond never accrues - `AI = 0`, and its clean and dirty prices are identical. Both behaviours are asserted in [`pricing.test.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/domain/formulas/pricing.test.ts).

---

## 3. Cash-flow schedule

Coupon dates are generated **backward from maturity** so the final coupon lands exactly on the maturity date; the first (stub) period is anchored at the issue date. Each scheduled date is then rolled to a good business day under the bond's business-day convention and payment calendar (§6).

The schedule contains one `COUPON` flow per future period plus one `PRINCIPAL` flow returning face value at maturity. When `cashFlow.includeInitialOutflow` is set, a negative `INITIAL_OUTFLOW` equal to the dirty settlement amount is prepended, so the schedule represents the full investor cash profile (and is exactly the input the yield solver inverts).

---

## 4. Pricing

### Fixed-rate

The dirty price is the present value of all remaining cash flows discounted at the periodic yield `y / f`, where `f` is the compounding/coupon frequency:

```
DirtyPrice = Σ_k  CF_k / (1 + y/f)^(f · t_k)
```

with `t_k` the day-count time from settlement to flow `k`. The **clean price** removes accrued interest:

```
CleanPrice = DirtyPrice − AccruedInterest
```

On a coupon date (zero accrued) clean equals dirty; when the yield equals the coupon rate the bond prices at par; yields below the coupon produce a premium and above it a discount. These identities are the backbone of [`pricing.test.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/domain/formulas/pricing.test.ts).

### Zero-coupon

A single redemption discounted to settlement:

```
Price = Redemption / (1 + y)^t
```

discounted with annual compounding, consistent with how the zero-coupon yield is quoted.

---

## 5. Discount rate (yield) - the waterfall

The "discount rate" used to value a bond is resolved through a configurable, ordered **waterfall** (`specifications/BondFormulaOptions`). The first method that can produce a rate wins:

1. **`implied_from_price`** - invert the observed market price to recover yield-to-maturity.
2. **`official_rating`** - risk-free curve + a credit spread looked up from the issuer's official rating.
3. **`internal_rating`** - risk-free curve + a spread from an in-house rating mapping.
4. **`manual_spread`** - risk-free curve + an analyst-supplied spread.
5. **`manual_rate`** - an analyst-supplied absolute rate.

This mirrors how a desk actually arrives at a valuation rate: prefer a traded price, fall back progressively to model- and judgement-based inputs. All five paths are demonstrated in the [Examples](/examples/).

### The implied-yield solver

For a fixed-rate bond there is no closed form for `y`, so the engine solves

```
PV(y) − DirtyPrice = 0
```

with **Newton–Raphson** (the price/yield function is smooth and monotonic), compounding at the coupon frequency. The solver round-trips to better than `1e-6`: pricing at a known yield and feeding the price back recovers the yield (see [`discountRate.test.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/domain/formulas/discountRate.test.ts)). The zero-coupon yield is obtained from a closed-form inverse with annual compounding. A short-maturity guard (under ~30 days) returns a simple holding-period return rather than annualising a tiny denominator.

---

## 6. Business-day adjustment & calendars

A scheduled date that falls on a weekend or holiday is rolled under one of:

- **`FOLLOWING`** - next business day.
- **`MODIFIED_FOLLOWING`** - next business day, unless it crosses into the next month, in which case roll *back* to the previous business day.
- **`PRECEDING`** / **`MODIFIED_PRECEDING`** - the mirror images.
- **`UNADJUSTED`** - leave the date as-is.

Business days are determined per **holiday calendar**. The calendars (NYSE, US Government Securities, SOFR, TARGET, LSE, EUREX, TSE, weekend-only) are generated from [QuantLib](https://www.quantlib.org/) by [`scripts/generate-calendars.py`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/scripts/generate-calendars.py) into a static JSON snapshot, so the engine itself needs no native dependency. Years outside the generated range fall back to weekend-only. Behaviour - including the month-boundary roll-back - is pinned in [`businessDay.test.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/domain/formulas/utilities/businessDay.test.ts).

---

## 7. Duration & convexity

From the same discounted cash flows the engine computes the first- and second-order price sensitivities together (one pass over the schedule):

- **Macaulay duration** - the cash-flow-time-weighted average life:
  `D_mac = Σ_k ( t_k · PV_k ) / Σ_k PV_k`
- **Modified duration** - price sensitivity to yield:
  `D_mod = D_mac / (1 + y/f)`
- **Dollar duration** - `D_mod × DirtyPrice × FaceValue / 100`, the money change in value per 100bp.
- **Convexity** - the curvature of the price/yield relationship, in years²:
  `C = Σ_k ( n_k(n_k+1) · PV_k ) / ( Σ_k PV_k · (1 + y/f)² · f² )`, where `n_k = f · t_k`.
- **Dollar convexity** - `C × DirtyPrice × FaceValue`, the money counterpart of the convexity term.

Duration and convexity combine into the standard second-order estimate of a price move for a yield change `Δy`:

```
ΔP/P ≈ −D_mod · Δy + ½ · C · Δy²
```

The convexity term is always positive for an option-free bullet bond, so duration alone *understates* the price gain from a yield fall and *overstates* the loss from a yield rise; convexity corrects both.

For a zero-coupon bond Macaulay duration equals its time to maturity and convexity reduces to `t(t + 1) / (1 + y)²` (a single cash flow, annual compounding). Both identities are checked directly in the test suite.

---

## 8. Term structure & spreads

A flat yield prices one bond in isolation. To place a bond *against the market* the engine builds a term structure - a [`DiscountCurve`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/src/domain/valueObjects/DiscountCurve.ts) - and measures the bond's spread relative to it.

### The discount curve

`DiscountCurve` is an immutable value object built from observed zero (spot) rates (`DiscountCurve.fromZeroRates`). Its one query is the discount factor:

```
DF(t) = 1 / (1 + z(t))^t
```

with **discrete annual compounding**, consistent with the flat-yield pricing in §4 - so a flat curve reproduces the flat-yield price exactly (pinned in [`pricing.test.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/domain/formulas/pricing.test.ts)). Between its pillars the curve interpolates by one of two recorded methods:

- **`LOG_LINEAR_DF`** (default) - linear in `ln(DF)`, i.e. **piecewise-constant forward rates**. The market-sane choice; it avoids the kinked, occasionally arbitrageable forwards that linear-on-yield can produce (Hagan & West, 2006).
- **`LINEAR_ZERO`** - linear on the zero rates themselves; offered for continuity with the older flat interpolation.

Beyond the first and last pillar the nearest zero rate is held **flat** - an explicit, documented extrapolation, never silent. `DF(0) = 1` exactly, and DF is monotonically decreasing in `t` for positive rates. These identities are pinned in [`discountCurve.test.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/domain/valueObjects/discountCurve.test.ts).

### Pricing off the curve

Pricing is opt-in via `pricingMode: "curve"` (the default `"flat_yield"` is unchanged). In curve mode each flow is discounted at its own curve factor rather than one flat rate:

```
DirtyPrice = Σ_k  CF_k · DF(t_k)
```

### Z-spread - the headline

The **Z-spread** `z` is the constant add-on to *every* zero rate of the curve that reprices the bond to its observed dirty price:

```
DirtyPrice = Σ_k  CF_k · (1 + z_base(t_k) + z)^(−t_k)
```

where `z_base(t)` is the curve's own zero rate at `t`. Because the present value is smooth and monotonic in `z`, the engine solves it with the same hardened **Newton–Raphson** machinery used for the implied yield (§5), starting from the curve itself (`z = 0`). A bond priced exactly on the curve has `z ≈ 0`; a richer (higher) price gives a smaller/negative spread and a cheaper price a larger one - the monotonicity is pinned in [`spreads.test.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/domain/formulas/spreads.test.ts).

### I-spread and G-spread

Two simpler curve-relative measures accompany the Z-spread:

- **I-spread** = bond yield − the (swap/benchmark) curve's zero rate at the bond's remaining life.
- **G-spread** = bond yield − a *government* curve's rate at the same life. Reported only when a government curve is supplied.

Where the Z-spread weighs the whole cash-flow profile against the whole curve, I/G-spreads compare a single yield to a single curve point at the bond's life - cheaper to read, coarser as a measure.

**Out of scope** (deliberately, to stay lean): OAS / callable pricing (needs a stochastic rate model), multi-curve OIS-discounting, and spline / monotone-convex interpolation.

---

## 9. Portfolio aggregation

Given positions `{ bond, quantity }` whose per-bond metrics have been computed:

- **Total market value** = Σ (dirty price × face × quantity), converted to the portfolio base currency using supplied FX rates.
- **Portfolio duration** = market-value-weighted average of constituent durations.
- **Average discount rate** = market-value-weighted average yield.
- **Aggregated cash flows** = union of constituent flows on a common timeline.

Multi-currency portfolios convert each position with the FX rate from the market-data snapshot at the settlement date; same-currency positions skip conversion. See [`portfolio.test.ts`](https://github.com/matasurbonavicius/Bond-Analytics/blob/main/tests/application/portfolio.test.ts).

---

## A note on precision and reference values

The golden-value tests pin engine output to Bloomberg figures for two real bonds. The fixed-rate bond matches to better than 0.001 of a price point and 3 decimals of yield. The zero-coupon implied yield lands ~0.3 bp from Bloomberg (2.5970% vs 2.5998%) - a documented sub-basis-point difference in zero-coupon yield convention, held to a 0.5 bp tolerance rather than masked by a loose bound.
