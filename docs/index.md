---
layout: home

hero:
  name: Bond Analytics
  text: Fixed-income math, in pure TypeScript
  tagline: Bond pricing, yield, accrued interest, duration, and portfolio metrics — across real day-count conventions and financial calendars. Zero runtime dependencies.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: View on GitHub
      link: https://github.com/matasurbonavicius/Bond-Analytics

features:
  - icon: 📐
    title: Correct, not just consistent
    details: Output is pinned in the test suite to Bloomberg-computed reference values for real government bonds, with price/yield round-trips verified to 1e-6.
  - icon: 🧩
    title: Zero dependencies
    details: All date and money arithmetic lives in first-class value objects. No native bindings, no framework — drops into a server, worker, CLI, or browser unchanged.
  - icon: 🏛️
    title: Real market conventions
    details: ACT/ACT, ACT/360, the 30/360 family and more; FOLLOWING / MODIFIED_FOLLOWING business-day rules; QuantLib-generated holiday calendars for NYSE, TARGET, EUREX, LSE, TSE…
  - icon: 🧮
    title: Domain-driven design
    details: A pure domain model orchestrated by a CalculationEngine that resolves a formula dependency graph, caches results, and detects cycles.
---
