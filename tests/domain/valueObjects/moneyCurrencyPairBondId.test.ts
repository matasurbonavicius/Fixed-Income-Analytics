/**
 * Targeted coverage for Money arithmetic / comparison error paths, the
 * CurrencyPair value object, and BondId identity semantics — areas the
 * existing value-object suite leaves uncovered.
 */
import { describe, it, expect } from "vitest";
import {
  Currency,
  CurrencyPair,
  BondId,
  Money,
  Percentage,
} from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";

const EUR = unwrap(Currency.create("EUR"));
const USD = unwrap(Currency.create("USD"));

function eur(amount: number): Money {
  return unwrap(Money.create(amount, EUR));
}
function usd(amount: number): Money {
  return unwrap(Money.create(amount, USD));
}
function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}

describe("Money — construction & conversion guards", () => {
  it("rejects a non-finite amount", () => {
    expect(Money.create(Infinity, EUR).success).toBe(false);
    expect(Money.create(NaN, EUR).success).toBe(false);
  });

  it("zero builds a zero-amount Money", () => {
    expect(unwrap(Money.zero(EUR)).amount).toBe(0);
  });

  it("convertTo rejects non-finite and non-positive rates", () => {
    expect(eur(100).convertTo(USD, NaN).success).toBe(false);
    expect(eur(100).convertTo(USD, 0).success).toBe(false);
    expect(eur(100).convertTo(USD, -1).success).toBe(false);
  });

  it("convertTo returns same amount when target currency matches", () => {
    const m = unwrap(eur(100).convertTo(EUR, 1.5));
    expect(m.amount).toBe(100);
    expect(m.currency.code).toBe("EUR");
  });

  it("convertTo applies the rate across currencies", () => {
    const m = unwrap(eur(100).convertTo(USD, 1.1));
    expect(m.amount).toBeCloseTo(110, 9);
    expect(m.currency.code).toBe("USD");
  });
});

describe("Money — arithmetic", () => {
  it("add and subtract require matching currencies", () => {
    expect(eur(10).add(usd(5)).success).toBe(false);
    expect(eur(10).subtract(usd(5)).success).toBe(false);
    expect(unwrap(eur(10).add(eur(5))).amount).toBe(15);
    expect(unwrap(eur(10).subtract(eur(4))).amount).toBe(6);
  });

  it("multiply / divide guard non-finite and zero divisor", () => {
    expect(eur(10).multiply(Infinity).success).toBe(false);
    expect(eur(10).divide(NaN).success).toBe(false);
    expect(eur(10).divide(0).success).toBe(false);
    expect(unwrap(eur(10).multiply(3)).amount).toBe(30);
    expect(unwrap(eur(10).divide(4)).amount).toBe(2.5);
  });

  it("negate and abs", () => {
    expect(unwrap(eur(-7).abs()).amount).toBe(7);
    expect(unwrap(eur(7).negate()).amount).toBe(-7);
  });

  it("multiplyByPercentage and divideByPercentage", () => {
    expect(unwrap(eur(200).multiplyByPercentage(pct(0.25))).amount).toBeCloseTo(50, 9);
    expect(unwrap(eur(50).divideByPercentage(pct(0.25))).amount).toBeCloseTo(200, 9);
    expect(eur(50).divideByPercentage(pct(0)).success).toBe(false);
  });

  it("presentValue and futureValue", () => {
    // PV of 110 at 10% over 1y == 100.
    expect(unwrap(eur(110).presentValue(pct(0.1), 1)).amount).toBeCloseTo(100, 9);
    // FV of 100 at 10% over 1y == 110.
    expect(unwrap(eur(100).futureValue(pct(0.1), 1)).amount).toBeCloseTo(110, 9);
    expect(eur(100).presentValue(pct(0.1), -1).success).toBe(false);
    expect(eur(100).presentValue(pct(0.1), NaN).success).toBe(false);
    expect(eur(100).futureValue(pct(0.1), -1).success).toBe(false);
  });
});

describe("Money — comparisons & predicates", () => {
  it("equals / isGreaterThan / isLessThan require matching currency", () => {
    expect(eur(10).equals(usd(10)).success).toBe(false);
    expect(eur(10).isGreaterThan(usd(1)).success).toBe(false);
    expect(eur(10).isLessThan(usd(1)).success).toBe(false);
  });

  it("comparisons return correct booleans", () => {
    expect(unwrap(eur(10).equals(eur(10)))).toBe(true);
    expect(unwrap(eur(10).isGreaterThan(eur(5)))).toBe(true);
    expect(unwrap(eur(2).isLessThan(eur(5)))).toBe(true);
  });

  it("isZero / isPositive / isNegative", () => {
    expect(eur(0).isZero()).toBe(true);
    expect(eur(3).isPositive()).toBe(true);
    expect(eur(-3).isNegative()).toBe(true);
  });

  it("toString and toAmountString format with currency decimals", () => {
    const s = eur(1234.5).toString();
    expect(s).toContain("1234.50");
    expect(eur(1234.5).toAmountString()).toBe("1234.50");
  });
});

describe("CurrencyPair", () => {
  it("rejects a pair of identical currencies", () => {
    const result = CurrencyPair.create(EUR, EUR);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("same currency");
  });

  it("exposes base, quote and code", () => {
    const pair = unwrap(CurrencyPair.create(EUR, USD));
    expect(pair.base.code).toBe("EUR");
    expect(pair.quote.code).toBe("USD");
    expect(pair.code).toBe("EUR/USD");
    expect(pair.toString()).toBe("EUR/USD");
  });

  it("invert swaps base and quote", () => {
    const pair = unwrap(CurrencyPair.create(EUR, USD));
    const inv = pair.invert();
    expect(inv.code).toBe("USD/EUR");
  });

  it("equals is exact (direction-sensitive)", () => {
    const a = unwrap(CurrencyPair.create(EUR, USD));
    const b = unwrap(CurrencyPair.create(EUR, USD));
    const c = unwrap(CurrencyPair.create(USD, EUR));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it("matchesInverted treats EUR/USD and USD/EUR as a match", () => {
    const a = unwrap(CurrencyPair.create(EUR, USD));
    const c = unwrap(CurrencyPair.create(USD, EUR));
    expect(a.matchesInverted(c)).toBe(true);
    expect(a.matchesInverted(a)).toBe(false);
  });
});

describe("BondId", () => {
  it("requires at least one identifier", () => {
    const result = BondId.create({});
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("required");
  });

  it("falls back to isin then cusip for the primary id", () => {
    const byIsin = unwrap(BondId.create({ isin: "XS123" }));
    expect(byIsin.primary).toBe("XS123");
    const byCusip = unwrap(BondId.create({ cusip: "037833100" }));
    expect(byCusip.primary).toBe("037833100");
  });

  it("prefers explicit primary, trimming whitespace", () => {
    const id = unwrap(BondId.create({ primary: "  P1  ", isin: "XS9" }));
    expect(id.primary).toBe("P1");
    expect(id.isin).toBe("XS9");
  });

  it("matches() checks the raw string against all identifiers", () => {
    const id = unwrap(BondId.create({ primary: "P", isin: "XS1", cusip: "C9" }));
    expect(id.matches("P")).toBe(true);
    expect(id.matches("XS1")).toBe(true);
    expect(id.matches("C9")).toBe(true);
    expect(id.matches("nope")).toBe(false);
  });

  it("equals() matches on any shared identifier", () => {
    const a = unwrap(BondId.create({ primary: "A", isin: "XS1" }));
    const b = unwrap(BondId.create({ primary: "B", isin: "XS1" }));
    const c = unwrap(BondId.create({ primary: "C", isin: "XS2" }));
    expect(a.equals(b)).toBe(true); // shared ISIN
    expect(a.equals(c)).toBe(false);
  });
});
