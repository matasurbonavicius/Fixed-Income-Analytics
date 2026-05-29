/**
 * Value-object tests, kept deliberately thin. Most VOs are trivial wrappers
 * exercised end-to-end by the golden and service suites, so here we keep only
 * one sanity test per object plus the genuinely non-obvious behaviour each one
 * carries. The two objects with real logic — UTCDate (calendar math) and
 * CreditRating (the tri-agency mapping table) — are covered more fully.
 */
import { describe, it, expect } from "vitest";
import {
  Money,
  Percentage,
  Currency,
  CurrencyPair,
  BondId,
  CreditRating,
  UTCDate,
} from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";

const EUR = unwrap(Currency.create("EUR"));
const USD = unwrap(Currency.create("USD"));
const eur = (n: number) => unwrap(Money.create(n, EUR));

describe("Currency", () => {
  it("creates, normalises case, and honours zero-decimal currencies", () => {
    expect(unwrap(Currency.create("eur")).code).toBe("EUR");
    expect(unwrap(Currency.create("JPY")).decimals).toBe(0); // configured 0, not defaulted to 2
    expect(Currency.create("XYZ").success).toBe(false);
  });
});

describe("Percentage", () => {
  it("converts between decimal and percent scales", () => {
    expect(unwrap(Percentage.fromDecimal(0.035)).asPercent).toBeCloseTo(3.5, 10);
    expect(unwrap(Percentage.fromPercent(3.5)).asDecimal).toBeCloseTo(0.035, 10);
    expect(unwrap(Percentage.fromDecimal(0.035)).equals(unwrap(Percentage.fromPercent(3.5)))).toBe(true);
  });

  it("rejects non-finite inputs", () => {
    expect(Percentage.fromDecimal(Infinity).success).toBe(false);
    expect(Percentage.fromPercent(NaN).success).toBe(false);
  });
});

describe("Money", () => {
  it("guards currency mismatch on arithmetic and comparison", () => {
    expect(eur(10).add(unwrap(Money.create(5, USD))).success).toBe(false);
    expect(eur(10).equals(unwrap(Money.create(10, USD))).success).toBe(false);
    expect(unwrap(eur(10).add(eur(5))).amount).toBe(15);
  });

  it("guards bad scalars on multiply/divide/convert", () => {
    expect(eur(10).divide(0).success).toBe(false);
    expect(eur(10).multiply(Infinity).success).toBe(false);
    expect(eur(100).convertTo(USD, -1).success).toBe(false);
    expect(unwrap(eur(100).convertTo(USD, 1.1)).amount).toBeCloseTo(110, 9);
  });

  it("presentValue / futureValue discount and grow by (1+r)^t", () => {
    expect(unwrap(eur(110).presentValue(unwrap(Percentage.fromPercent(10)), 1)).amount).toBeCloseTo(100, 9);
    expect(unwrap(eur(100).futureValue(unwrap(Percentage.fromPercent(10)), 1)).amount).toBeCloseTo(110, 9);
    expect(eur(100).presentValue(unwrap(Percentage.fromPercent(5)), -1).success).toBe(false);
  });

  it("toString respects currency symbol and decimals", () => {
    expect(eur(100).toString()).toBe("€100.00");
    expect(unwrap(Money.create(100, unwrap(Currency.create("JPY")))).toString()).toBe("¥100");
  });
});

describe("CurrencyPair", () => {
  it("rejects identical currencies and exposes/inverts the pair", () => {
    expect(CurrencyPair.create(EUR, EUR).success).toBe(false);
    const pair = unwrap(CurrencyPair.create(EUR, USD));
    expect(pair.code).toBe("EUR/USD");
    expect(pair.invert().code).toBe("USD/EUR");
    expect(pair.matchesInverted(unwrap(CurrencyPair.create(USD, EUR)))).toBe(true);
  });
});

describe("BondId", () => {
  it("requires an identifier and resolves the primary id", () => {
    expect(BondId.create({}).success).toBe(false);
    expect(unwrap(BondId.create({ isin: "XS123" })).primary).toBe("XS123");
    expect(unwrap(BondId.create({ primary: "  P1  ", isin: "XS9" })).primary).toBe("P1");
  });

  it("equals() matches on any shared identifier", () => {
    const a = unwrap(BondId.create({ primary: "A", isin: "XS1" }));
    const b = unwrap(BondId.create({ primary: "B", isin: "XS1" })); // shared ISIN
    const c = unwrap(BondId.create({ primary: "C", isin: "XS2" }));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe("CreditRating", () => {
  it("creates case-insensitively from any agency code and rejects unknowns", () => {
    expect(unwrap(CreditRating.create("bbb")).sp).toBe("BBB");
    const r = unwrap(CreditRating.create("Baa2")); // Moody's input
    expect(r.code).toBe(9);
    expect(r.sp).toBe("BBB");
    expect(CreditRating.create("ZZZ").success).toBe(false);
  });

  it("maps across all three agencies for a numeric code", () => {
    const r = CreditRating.fromNumeric(9)!;
    expect(r.sp).toBe("BBB");
    expect(r.moodys).toBe("Baa2");
    expect(r.fitch).toBe("BBB");
    expect(CreditRating.fromNumeric(0)?.sp).toBe("Not Rated");
  });

  it("fromNumeric guards out-of-range and non-integer codes", () => {
    expect(CreditRating.fromNumeric(-1)).toBeUndefined();
    expect(CreditRating.fromNumeric(22)).toBeUndefined();
    expect(CreditRating.fromNumeric(1.5)).toBeUndefined();
  });
});

describe("UTCDate", () => {
  it("parses ISO strings and rejects malformed/invalid ones", () => {
    const d = unwrap(UTCDate.fromString("2026-05-28"));
    expect([d.year, d.month, d.day]).toEqual([2026, 4, 28]); // month 0-indexed
    expect(UTCDate.fromString("28-05-2026").success).toBe(false);
    expect(UTCDate.fromComponents(2026, 1, 30).success).toBe(false); // Feb 30
  });

  it("computes leap years including century rules", () => {
    expect(unwrap(UTCDate.fromString("2024-01-01")).isLeapYear()).toBe(true);
    expect(unwrap(UTCDate.fromString("1900-01-01")).isLeapYear()).toBe(false);
    expect(unwrap(UTCDate.fromString("2000-01-01")).isLeapYear()).toBe(true);
  });

  it("daysInMonth handles February in leap vs non-leap years", () => {
    expect(unwrap(UTCDate.fromString("2024-02-15")).daysInMonth()).toBe(29);
    expect(unwrap(UTCDate.fromString("2026-02-15")).daysInMonth()).toBe(28);
  });

  it("addMonths clamps month-end rollover", () => {
    // Jan 31 + 1 month clamps to Feb 28 (2026 non-leap), not Mar 3.
    expect(unwrap(unwrap(UTCDate.fromString("2026-01-31")).addMonths(1)).toISOString()).toBe("2026-02-28");
  });

  it("addDays crosses year boundaries and endOfMonth respects leap years", () => {
    expect(unwrap(unwrap(UTCDate.fromString("2026-12-31")).addDays(1)).toISOString()).toBe("2027-01-01");
    expect(unwrap(unwrap(UTCDate.fromString("2024-02-15")).endOfMonth()).toISOString()).toBe("2024-02-29");
  });

  it("daysUntil counts signed calendar days and comparison helpers order dates", () => {
    const a = unwrap(UTCDate.fromString("2026-01-01"));
    const b = unwrap(UTCDate.fromString("2026-01-11"));
    expect(a.daysUntil(b)).toBe(10);
    expect(b.daysUntil(a)).toBe(-10);
    expect(a.isBefore(b)).toBe(true);
    expect(a.equals(unwrap(UTCDate.fromString("2026-01-01")))).toBe(true);
  });
});
