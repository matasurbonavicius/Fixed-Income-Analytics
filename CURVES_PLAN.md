# Plan: A Real Term-Structure (Yield-Curve) Layer

> **Status:** proposal for review. No code written yet.
> **Goal stated by maintainer:** become *the default fixed-income library for JS/TS* — win on
> correctness, types, determinism, and auditability, not on exotic instrument breadth.
> **License:** stays Apache-2.0 (unchanged).

---

## 0. TL;DR — what to build and why, in one paragraph

Today every cash flow is discounted at a **single flat yield**. That is correct for quoting one
bond in isolation, but every higher-order fixed-income number a desk actually wants —
**Z-spread, asset-swap spread, relative value, key-rate durations, and eventually callable-bond
pricing** — is defined *relative to a discount curve*, not a flat yield. The library already has a
half-built curve (`interpolateYieldCurve`, linear-on-yield, used only as a fallback). Finishing it
into a proper **`DiscountCurve`** value object — then discounting off it, then solving a
**Z-spread** against it — is the single change that upgrades the correctness of everything already
shipped *and* unlocks the next tier of analytics. Z-spread is the headline deliverable: it's the
moment the project stops being "a bond calculator" and becomes "a fixed-income analytics library,"
exactly as convexity was the moment duration became a risk metric.

---

## 1. Why this, and why not the alternatives

### Why a curve is the keystone

A flat-yield model answers *"what is the yield/duration of this one bond?"* A curve answers
*"how does this bond sit against the market?"* — which is the question that makes a tool a desk's
standard. Concretely, these are all **impossible without a term structure** and all **trivial-to-moderate once you have one**:

| Metric | Needs a curve because… |
|---|---|
| **Z-spread** | It's the constant spread added to the *whole zero curve* that reprices the bond. |
| **Asset-swap / I-spread / G-spread** | Bond yield minus the *curve* at the bond's tenor/life. |
| **Key-rate (partial) durations** | Sensitivity to a bump at *each curve node* — the curve **is** the object. |
| **Relative value / richness-cheapness** | "Cheap vs the curve" has no meaning without the curve. |
| **Callable / putable pricing** (future) | Needs a term-structure model as its foundation. You **cannot** add these first. |

So even the "add more instruments" roadmap runs *through* this work. Building the curve is not a
detour from instrument coverage — it's the prerequisite for the only instruments worth adding next.

### Why not "just add more bond types" now

Adding floating-rate / amortizing / callable bonds on top of a flat-yield model gives you more
instruments priced with a toy engine. The curve work instead **raises the correctness of the two
instruments already shipped** and is reusable by every future instrument. Depth before breadth.

### The honest counter-argument

If the product is only ever "single-bond YTM + duration," you don't strictly need a curve. But that
is a smaller tool, not an industry standard. A desk that cannot compute a Z-spread will not adopt
the library as its default. We are choosing the standard-setting path deliberately.

---

## 2. What exists today (so you can see the seam)

Read these in order to understand the current state before/while reviewing the plan:

1. **`src/domain/dataStructures/marketData/MarketData.ts`** — the `YieldCurve` interface
   (lines 13–19): a bag of `{ tenor, rate }` points. This is data, not a curve object.
2. **`src/domain/dataStructures/marketData/MarketDataStore.helpers.ts`** — `interpolateYieldCurve`
   (lines 41–95). **This is the entire current "curve."** Note three weaknesses:
   - It interpolates **linearly on yields** (line 82–88). Market practice is log-linear on
     discount factors or monotone-convex on zero rates; linear-on-yield can produce non-smooth,
     even arbitrageable, forward rates.
   - It is a **stateless lookup**, not an object — there is no `discountFactor(t)`,
     `zeroRate(t)`, or `forwardRate(t1,t2)`.
   - Flat extrapolation past both ends (lines 65–74) is silent.
3. **`src/application/formulas/bondFormulas/formulas/DiscountRateFormula.ts`** —
   `tryYieldCurveMethod` (lines 253–315). This is the **only** consumer of the curve, and it
   immediately **collapses the whole curve to a single number** (`interpolateYieldCurve` at the
   bond's years-to-maturity, line 290) and adds a flat spread. The term structure is discarded.
4. **`src/domain/formulas/bond/dirtyPrice/DirtyPrice.math.fixed.ts`** — pricing discounts every
   flow at one periodic rate `y/f`. This is the function that will gain an *optional* curve path.

**Takeaway:** the curve is consumed in exactly one place and never used to discount. That is the
seam. The plan widens it without disturbing the flat-yield path that the golden tests pin.

---

## 3. Design principles (match the existing codebase)

These are not new rules — they're the conventions already in the repo, restated so the new code
falls in gracefully:

- **Domain stays pure.** All curve math lives in `src/domain/`, returns `Result<T>`, no I/O, no
  exceptions. Mirror `formulas/bond/duration/`.
- **Value objects, not bare numbers.** A `DiscountCurve` is an immutable value object built once
  and queried, like `Money` / `Percentage`. Construction validates and returns `Result<DiscountCurve>`.
- **Additive, never breaking.** The flat-yield pricing path is the default and stays bit-for-bit
  unchanged. Curve discounting is **opt-in** via options. The golden tests must not move.
- **Determinism & auditability** (the product's differentiator): a curve built from the same inputs
  always yields the same discount factors; the interpolation method is explicit and recorded, never
  implicit. This is what QuantLib does *not* give you and what we sell.
- **Reuse the solver.** Z-spread reuses the hardened Newton–Raphson already used for implied yield
  (see `formulas/bond/discountRate/`), not a new root-finder.

---

## 4. The build, in shippable phases

Each phase is independently valuable and independently testable. Stop after any phase and the
library is still coherent.

### Phase 1 — `DiscountCurve` value object + correct interpolation

**What:** a real curve object that turns observed points into a continuous discount function.

- **New:** `src/domain/valueObjects/DiscountCurve.ts` (or `src/domain/dataStructures/curves/` if you
  prefer to keep it beside market data — recommend **value object**, since it's an immutable,
  validated, queryable primitive like `Money`).
- **Public surface:**
  ```ts
  interface DiscountCurve {
    discountFactor(t: number): Result<number>;        // DF(t); the primitive everything derives from
    zeroRate(t: number): Result<Percentage>;          // zero (spot) rate to time t
    forwardRate(t1: number, t2: number): Result<Percentage>;
    interpolation: CurveInterpolation;                 // recorded for audit
  }
  ```
- **Construction:** `DiscountCurve.fromZeroRates(points, { interpolation })` and
  `DiscountCurve.fromDiscountFactors(points, …)`. Validate: ≥1 point, tenors > 0, strictly
  increasing after sort, finite rates. Return `Result`.
- **Interpolation methods** (`CurveInterpolation` enum): start with two, default to the market-sane one.
  - `LOG_LINEAR_DF` (**default**) — linear in `ln(DF)`, i.e. piecewise-constant forward rates. The
    standard, arbitrage-free-enough default.
  - `LINEAR_ZERO` — linear on zero rates (closest to today's behaviour; offered for continuity).
  - (Leave `MONOTONE_CONVEX` / cubic spline as a documented future option — do **not** build yet.)
- **Extrapolation:** flat in zero-rate beyond both ends, but **explicit** (a flag), not silent.

**Why first:** it's the foundation, it's pure math with zero integration risk, and it immediately
makes the existing `interpolateYieldCurve` honest. Nothing else can be built without it.

**Methods / where to read:**
- Discount-factor interpolation & no-arbitrage forwards: Hagan & West, *"Interpolation Methods for
  Curve Construction"* (Applied Mathematical Finance, 2006) — the canonical reference, explains why
  log-linear-on-DF ≈ piecewise-flat forwards and why linear-on-yield is discouraged.
- Andersen & Piterbarg, *Interest Rate Modeling, Vol. I*, ch. on curve interpolation (rigorous).
- Quick orientation: OpenGamma *"Interest Rate Instruments and Market Conventions Guide"* (free PDF).
- In-repo pattern to mirror: `src/domain/valueObjects/Money.ts` (immutable, `Result`-returning
  factory) and `src/domain/formulas/bond/duration/` (pure-math module layout).

---

### Phase 2 — discount off the curve (opt-in pricing path)

**What:** let pricing discount each cash flow at `DF(t_k)` from a `DiscountCurve` instead of a flat
`y/f`.

- **Touch:** `src/domain/formulas/bond/dirtyPrice/DirtyPrice.math.fixed.ts` and `.zero.ts`. Add a
  variant (e.g. `calculateDirtyPriceFixedFromCurve(input, curve)`) that loops the same future flows
  but replaces `1/(1+y/f)^n` with `curve.discountFactor(t_k)`. Keep the existing
  `…FromYield` functions untouched.
- **Wire (application):** a new option, e.g. `pricingMode: "flat_yield" | "curve"` on
  `BondFormulaOptions`, consumed by `DirtyPriceFormula`. Default `"flat_yield"` → **no behaviour
  change**, golden tests stay green.
- **Curve source:** build the `DiscountCurve` once from `MarketData.yieldCurve` for the bond's
  currency (extend `getYieldCurve` to optionally return a built curve).

**Why second:** proves the curve object works end-to-end and gives "price a bond off a supplied
zero curve" — already useful on its own, and the substrate Phase 3 needs.

**Methods / where to read:** standard PV-off-curve, `P = Σ CF_k · DF(t_k)`. Same Fabozzi /
Tuckman material as below. In-repo: `DirtyPrice.math.fixed.ts` is the function to clone.

---

### Phase 3 — **Z-spread** (the headline feature)

**What:** the constant continuously-/annually-compounded spread `z` added to every zero rate such
that the curve-discounted PV equals the bond's observed dirty price:

```
DirtyPrice = Σ_k  CF_k · DF(t_k) · e^(−z · t_k)        (or the discrete-compounding analogue)
solve for z.
```

- **New domain module:** `src/domain/formulas/bond/zSpread/` mirroring the `duration/` layout:
  `ZSpread.types.ts`, `ZSpread.math.ts`, `ZSpread.validation.ts`, `index.ts`. Reuse the existing
  **Newton–Raphson** machinery (same hardening, tolerance, bounds as the implied-yield solver in
  `formulas/bond/discountRate/`).
- **New application formula:** `ZSpreadFormula` under
  `src/application/formulas/bondFormulas/formulas/`, registered in
  `BondFormulaRegistry.ts` (`ALL_BOND_FORMULAS`, the same one-line add the existing formulas use).
  Depends on `dirtyPrice` (market price) + the built `DiscountCurve`, exactly like `DurationFormula`
  depends on `discountRate` + `cleanPrice`.
- **Surface in metrics:** add `zSpread?: Percentage` to `BondMetrics`
  (`src/domain/entities/Bond/Bond.types.ts` → `Bond.metrics.ts`), flowing through the engine the
  same way `duration` does.
- **Cheap add-ons once Z-spread exists:** **I-spread / G-spread** (bond YTM − interpolated curve
  rate at the bond's life) are a few lines each and pair naturally with Z-spread in the same module.

**Why this is the headline:** it's the most-requested credit number the library currently *cannot*
produce, it's a ~Newton-Raphson-sized lift on top of Phases 1–2, and it earns the "analytics
library" label. Treat it as the public milestone.

**Methods / where to read:**
- Z-spread definition & worked example: Fabozzi, *Bond Markets, Analysis, and Strategies* (the
  spread-measures chapter) — clearest practitioner treatment.
- Tuckman & Serrat, *Fixed Income Securities*, 4e — spreads vs the curve, asset-swap intuition.
- Z vs OAS distinction (so docs are precise): any of the above; OAS is explicitly **out of scope**
  here (needs a stochastic rate model — a later, separate effort).
- In-repo: clone the solver from `src/domain/formulas/bond/discountRate/` (implied-yield
  Newton–Raphson) and the module/registry/metrics wiring from the convexity work in
  `formulas/bond/duration/` + `Bond.metrics.ts` + `BondFormulaRegistry.ts`.

---

### Phase 4 — bootstrapping (build the curve from instruments)

**What:** construct the zero curve from observed par instruments (deposits, par bonds / swaps)
rather than requiring callers to supply zero rates.

- **New domain module:** `src/domain/formulas/curve/bootstrap/` — sequential bootstrap: solve each
  pillar's zero rate so the instrument prices to par, given all shorter pillars already solved.
- This is the deepest, most error-prone piece (pillar ordering, interpolation interaction,
  conventions). **Ship it last**, only after 1–3 are solid and have reference-value tests.

**Why last:** highest effort, and Phases 1–3 already deliver the headline value (price off a curve +
Z-spread) for callers who can supply a zero curve — which many can.

**Methods / where to read:** Hagan & West (above) for the interpolation-aware bootstrap; OpenGamma
multi-curve docs for modern conventions; Andersen & Piterbarg Vol. I for rigor.

---

## 5. Testing strategy (keep it direct, mirror the existing suite)

Follow the patterns already in `tests/` — no bloat, pin to identities and reference values:

- **Phase 1:** unit tests for `DiscountCurve` in `tests/domain/.../discountCurve.test.ts`.
  Pin identities that must hold *analytically*: `DF(0) = 1`; a flat zero-rate curve reproduces
  `DF(t) = e^(−r t)` (or discrete analogue) exactly; `forwardRate` between adjacent log-linear-DF
  nodes is constant; round-trip `zeroRate → DF → zeroRate`. Mirror `pricing.test.ts` builders.
- **Phase 2:** a flat curve at rate `y` must reproduce the **existing flat-yield dirty price** to
  ~1e-10 — this is the regression guard proving curve-mode and yield-mode agree in the flat case.
- **Phase 3:** Z-spread of a bond priced *exactly on the curve* is `≈ 0`; a richer (higher) price
  gives a negative Z-spread and vice-versa (monotonic); and a **golden** Z-spread for one real bond
  vs a known curve, pinned the way the Bloomberg golden tests are (`bondCalculation.golden.test.ts`).
- **Phase 4:** bootstrap must **reprice its input instruments to par** (round-trip), the strongest
  possible self-consistency check.

---

## 6. Scope guardrails (what this plan deliberately excludes)

To stay on the "default JS/TS library" path and not drift into the QuantLib race:

- ❌ **OAS / callable-bond pricing** — needs a stochastic short-rate model; separate future effort.
- ❌ **Monte Carlo / PDE solvers** — out of scope for this library entirely.
- ❌ **Multi-curve (OIS-discounting + projection)** — defer; single discounting curve first.
- ❌ **Cubic-spline / monotone-convex interpolation** — documented future option, not built now.
- ✅ **In scope:** `DiscountCurve` object, log-linear-DF + linear-zero interpolation, curve-based
  discounting, **Z-spread (headline)** + I/G-spread, and (last) a simple bootstrap.

---

## 7. Suggested order of execution

1. **Phase 1** — `DiscountCurve` + interpolation. (Foundation; no integration risk.)
2. **Phase 2** — opt-in curve discounting in `DirtyPrice` math + an options flag. (Proves it works.)
3. **Phase 3** — **Z-spread** + I/G-spread, registered formula, surfaced in `BondMetrics`. (Headline.)
4. **Phase 4** — bootstrapping. (Deepest; only after 1–3 are battle-tested.)

Each phase: domain math (pure, `Result`) → application formula/wiring → direct tests → a line in
`docs/concepts/methodology.md` (add a new "Term structure & spreads" section beside §7 Duration) →
a print line in the relevant `examples/*.demo.ts`.

---

## 8. One-screen reading list

- **Hagan & West (2006), "Interpolation Methods for Curve Construction"** — *the* curve-interpolation paper.
- **Fabozzi, *Bond Markets, Analysis, and Strategies*** — Z-spread / spread measures, practitioner-level.
- **Tuckman & Serrat, *Fixed Income Securities* (4e)** — curves, spreads, asset swaps.
- **Andersen & Piterbarg, *Interest Rate Modeling, Vol. I*** — rigorous curve construction & bootstrap.
- **OpenGamma, "Interest Rate Instruments and Market Conventions Guide"** (free) — conventions cheat-sheet.
- **In-repo to clone:** `src/domain/formulas/bond/duration/` (module shape),
  `src/domain/formulas/bond/discountRate/` (Newton–Raphson),
  `src/domain/valueObjects/Money.ts` (value-object pattern),
  `src/application/formulas/bondFormulas/BondFormulaRegistry.ts` (registration),
  `src/domain/entities/Bond/Bond.metrics.ts` (surfacing a metric).
