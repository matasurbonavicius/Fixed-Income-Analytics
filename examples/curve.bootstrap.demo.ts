/**
 * Bootstrap demo — build a zero curve from par instruments.
 *
 * A desk rarely holds zero (spot) rates directly; it holds *par quotes* — a
 * short-end deposit rate and a ladder of par bonds (priced at 100). This demo
 * feeds those to `bootstrapCurve`, which solves each pillar's discount factor so
 * the instrument reprices to par, then prints the implied zero curve and the
 * strongest self-consistency check there is: every input par bond, repriced off
 * the bootstrapped curve, comes back to exactly 100.
 *
 * Run: npx tsx examples/curve.bootstrap.demo.ts
 */
import { Percentage, DiscountCurve } from "@domain/valueObjects";
import { bootstrapCurve, type BootstrapInstrument } from "@domain/formulas";

// === INSTRUMENTS ============================================================
// A 1y deposit pins the front; 2y–5y annual par bonds build the rest. Each par
// bond's earlier coupons fall on pillars already solved by the shorter ones.
const instruments: BootstrapInstrument[] = [
  { kind: "ZERO_RATE", tenor: 1, rate: pct(0.024) },
  { kind: "PAR_BOND", tenor: 2, couponRate: pct(0.0255), frequency: 1 },
  { kind: "PAR_BOND", tenor: 3, couponRate: pct(0.0265), frequency: 1 },
  { kind: "PAR_BOND", tenor: 4, couponRate: pct(0.0275), frequency: 1 },
  { kind: "PAR_BOND", tenor: 5, couponRate: pct(0.028), frequency: 1 },
];

// === BOOTSTRAP ==============================================================
const curve = unwrap(bootstrapCurve({ instruments }));

console.log("=== BOOTSTRAPPED ZERO CURVE ===");
console.log("tenor   DF        zero rate");
for (const tenor of [1, 2, 3, 4, 5]) {
  const df = unwrap(curve.discountFactor(tenor));
  const zero = Math.pow(df, -1 / tenor) - 1;
  console.log(
    `  ${tenor}y   ${df.toFixed(6)}   ${(zero * 100).toFixed(4)}%`
  );
}
console.log();

// === ROUND-TRIP CHECK =======================================================
// Reprice each par bond off the curve we just built. By construction every one
// must return to par (100) — the bootstrap's defining guarantee.
console.log("=== ROUND-TRIP: each input par bond repriced off the curve ===");
for (const inst of instruments) {
  if (inst.kind !== "PAR_BOND") continue;
  const price = priceAnnualBond(curve, inst.tenor, inst.couponRate.asDecimal);
  console.log(
    `  ${inst.tenor}y @ ${(inst.couponRate.asPercent).toFixed(
      3
    )}%  ->  ${(price * 100).toFixed(8)}`
  );
}

/**
 * Price an annual-coupon par bond off `curve`: coupon at each integer year plus
 * 100% principal at maturity. Returns the price as a fraction of par.
 */
function priceAnnualBond(
  c: DiscountCurve,
  tenor: number,
  couponRate: number
): number {
  let pv = 0;
  for (let t = 1; t <= tenor; t++) {
    pv += couponRate * unwrap(c.discountFactor(t));
  }
  pv += unwrap(c.discountFactor(tenor));
  return pv;
}

/** A Percentage from a decimal — keeps the instrument list terse. */
function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}

/** Unwrap a Result, throwing on failure — keeps the demo terse. */
function unwrap<T>(
  result: { success: true; value: T } | { success: false; error: string }
): T {
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.value;
}
