---
layout: home

hero:
  name: Fixed Income Analytics
  text: Fixed-income math, in pure TypeScript
  tagline: Bond pricing, yield, accrued interest, duration, and portfolio metrics - across real day-count conventions and financial calendars. Zero runtime dependencies.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: View on GitHub
      link: https://github.com/matasurbonavicius/Fixed-Income-Analytics

features:
  - icon: 📐
    title: Correct, not just consistent
    details: Output is pinned in the test suite to Bloomberg-computed reference values for real government bonds, with price/yield round-trips verified to 1e-6.
  - icon: 🧩
    title: Zero dependencies
    details: All date and money arithmetic lives in first-class value objects. No native bindings, no framework - drops into a server, worker, CLI, or browser unchanged.
  - icon: 🏛️
    title: Real market conventions
    details: ACT/ACT, ACT/360, the 30/360 family and more; FOLLOWING / MODIFIED_FOLLOWING business-day rules; QuantLib-generated holiday calendars for NYSE, TARGET, EUREX, LSE, TSE…
  - icon: 🧮
    title: Domain-driven design
    details: A pure domain model orchestrated by a CalculationEngine that resolves a formula dependency graph, caches results, and detects cycles.
---

## Price a bond in a few lines

```bash
npm install fixed-income-analytics
```

```ts
import { BondCalculationService } from "fixed-income-analytics";

// build a Bond, a MarketDataStore, and options (see the Quickstart), then:
const { updatedBond } = unwrap(
  await BondCalculationService.calculate(bond, marketDataStore, options)
);

const m = updatedBond.props.metrics!;
m.dirtyPrice!.asPercent;              // 104.2208
m.cleanPrice!.asPercent;              // 102.2935
m.duration!.modifiedDuration;         // 4.825
m.discountRate!.discountRate.asPercent; // 3.0341
```

Those figures are pinned in the test suite against **Bloomberg-computed reference
values** for a real government bond. See the [Quickstart](/guide/quickstart) for the
full, runnable version, or the [Examples](/examples/) for ten end-to-end scenarios.

<div style="margin-top: 2rem; text-align: center; opacity: 0.7; font-size: 0.9em;">
Zero runtime dependencies · ESM + CommonJS · bundled types · Node 18+ · Apache-2.0
</div>
