import { describe, it, expect } from "vitest";
import {
  Money,
  Percentage,
  Currency,
  CreditRating,
  UTCDate,
} from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";

// Convenience builders that assert success at construction time.
const eur = () => unwrap(Currency.create("EUR"));
const usd = () => unwrap(Currency.create("USD"));

describe("Currency", () => {
  it("creates a valid currency and exposes its metadata", () => {
    const c = unwrap(Currency.create("EUR"));
    expect(c.code).toBe("EUR");
    expect(c.symbol).toBe("€");
    expect(c.name).toBe("Euro");
    expect(c.decimals).toBe(2);
  });

  it("normalizes lowercase codes to uppercase", () => {
    const c = unwrap(Currency.create("usd"));
    expect(c.code).toBe("USD");
    expect(c.symbol).toBe("$");
  });

  it("honours zero-decimal currencies (JPY)", () => {
    // JPY is configured with decimals: 0; the getter uses `?? 2` so the
    // configured 0 is preserved rather than overridden.
    const c = unwrap(Currency.create("JPY"));
    expect(c.decimals).toBe(0);
  });

  it("rejects unsupported codes", () => {
    const res = Currency.create("XYZ");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("XYZ");
    }
  });

  it("equals compares by code only", () => {
    expect(unwrap(Currency.create("EUR")).equals(unwrap(Currency.create("eur")))).toBe(true);
    expect(unwrap(Currency.create("EUR")).equals(usd())).toBe(false);
  });
});

describe("Percentage", () => {
  it("fromDecimal stores the decimal directly", () => {
    const p = unwrap(Percentage.fromDecimal(0.035));
    expect(p.asDecimal).toBeCloseTo(0.035, 10);
    expect(p.asPercent).toBeCloseTo(3.5, 10);
  });

  it("fromPercent converts percent to decimal", () => {
    const p = unwrap(Percentage.fromPercent(3.5));
    expect(p.asDecimal).toBeCloseTo(0.035, 10);
    expect(p.asPercent).toBeCloseTo(3.5, 10);
  });

  it("fromDecimal and fromPercent agree for the same logical value", () => {
    const a = unwrap(Percentage.fromDecimal(0.035));
    const b = unwrap(Percentage.fromPercent(3.5));
    expect(a.equals(b)).toBe(true);
  });

  it("roundtrips decimal -> percent -> decimal", () => {
    const original = unwrap(Percentage.fromDecimal(0.1234));
    const roundtrip = unwrap(Percentage.fromPercent(original.asPercent));
    expect(roundtrip.asDecimal).toBeCloseTo(original.asDecimal, 10);
  });

  it("zero is zero on both scales", () => {
    const z = unwrap(Percentage.zero());
    expect(z.asDecimal).toBe(0);
    expect(z.asPercent).toBe(0);
    expect(z.isZero()).toBe(true);
  });

  it("rejects non-finite inputs", () => {
    expect(Percentage.fromDecimal(Infinity).success).toBe(false);
    expect(Percentage.fromDecimal(NaN).success).toBe(false);
    expect(Percentage.fromPercent(NaN).success).toBe(false);
  });

  it("add and subtract operate on the decimal scale", () => {
    const a = unwrap(Percentage.fromPercent(2));
    const b = unwrap(Percentage.fromPercent(3));
    expect(unwrap(a.add(b)).asPercent).toBeCloseTo(5, 10);
    expect(unwrap(b.subtract(a)).asPercent).toBeCloseTo(1, 10);
  });

  it("negate / abs / sign predicates", () => {
    const p = unwrap(Percentage.fromPercent(4));
    const neg = unwrap(p.negate());
    expect(neg.isNegative()).toBe(true);
    expect(unwrap(neg.abs()).equals(p)).toBe(true);
    expect(p.isPositive()).toBe(true);
  });
});

describe("Money", () => {
  it("creates money and exposes amount + currency", () => {
    const m = unwrap(Money.create(100.5, eur()));
    expect(m.amount).toBe(100.5);
    expect(m.currency.code).toBe("EUR");
  });

  it("zero creates a zero-amount money", () => {
    const m = unwrap(Money.zero(eur()));
    expect(m.amount).toBe(0);
    expect(m.isZero()).toBe(true);
  });

  it("rejects non-finite amounts", () => {
    expect(Money.create(Infinity, eur()).success).toBe(false);
    expect(Money.create(NaN, eur()).success).toBe(false);
  });

  it("adds two amounts of the same currency", () => {
    const a = unwrap(Money.create(100, eur()));
    const b = unwrap(Money.create(50, eur()));
    expect(unwrap(a.add(b)).amount).toBe(150);
  });

  it("subtracts two amounts of the same currency", () => {
    const a = unwrap(Money.create(100, eur()));
    const b = unwrap(Money.create(30, eur()));
    expect(unwrap(a.subtract(b)).amount).toBe(70);
  });

  it("fails to add across currencies", () => {
    const a = unwrap(Money.create(100, eur()));
    const b = unwrap(Money.create(50, usd()));
    const res = a.add(b);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("Currency mismatch");
    }
  });

  it("fails to subtract across currencies", () => {
    const a = unwrap(Money.create(100, eur()));
    const b = unwrap(Money.create(50, usd()));
    expect(a.subtract(b).success).toBe(false);
  });

  it("multiply and divide scale the amount", () => {
    const m = unwrap(Money.create(100, eur()));
    expect(unwrap(m.multiply(2.5)).amount).toBe(250);
    expect(unwrap(m.divide(4)).amount).toBe(25);
  });

  it("divide by zero fails", () => {
    const m = unwrap(Money.create(100, eur()));
    const res = m.divide(0);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("zero");
  });

  it("negate and abs", () => {
    const m = unwrap(Money.create(-100, eur()));
    expect(unwrap(m.negate()).amount).toBe(100);
    expect(unwrap(m.abs()).amount).toBe(100);
    expect(m.isNegative()).toBe(true);
  });

  it("convertTo same currency keeps amount regardless of rate", () => {
    const m = unwrap(Money.create(100, eur()));
    const converted = unwrap(m.convertTo(eur(), 1.5));
    expect(converted.amount).toBe(100);
    expect(converted.currency.code).toBe("EUR");
  });

  it("convertTo different currency applies the rate", () => {
    const m = unwrap(Money.create(100, eur()));
    const converted = unwrap(m.convertTo(usd(), 1.1));
    expect(converted.amount).toBeCloseTo(110, 10);
    expect(converted.currency.code).toBe("USD");
  });

  it("convertTo rejects non-positive or non-finite rates", () => {
    const m = unwrap(Money.create(100, eur()));
    expect(m.convertTo(usd(), 0).success).toBe(false);
    expect(m.convertTo(usd(), -1).success).toBe(false);
    expect(m.convertTo(usd(), Infinity).success).toBe(false);
  });

  it("multiplyByPercentage applies the decimal value", () => {
    const m = unwrap(Money.create(1000, eur()));
    const p = unwrap(Percentage.fromPercent(5));
    expect(unwrap(m.multiplyByPercentage(p)).amount).toBeCloseTo(50, 10);
  });

  it("presentValue discounts by (1+r)^t", () => {
    const m = unwrap(Money.create(110, eur()));
    const r = unwrap(Percentage.fromPercent(10));
    const pv = unwrap(m.presentValue(r, 1));
    expect(pv.amount).toBeCloseTo(100, 10);
  });

  it("presentValue rejects negative time", () => {
    const m = unwrap(Money.create(100, eur()));
    const r = unwrap(Percentage.fromPercent(5));
    expect(m.presentValue(r, -1).success).toBe(false);
  });

  it("futureValue grows by (1+r)^t", () => {
    const m = unwrap(Money.create(100, eur()));
    const r = unwrap(Percentage.fromPercent(10));
    const fv = unwrap(m.futureValue(r, 1));
    expect(fv.amount).toBeCloseTo(110, 10);
  });

  it("comparison methods within the same currency", () => {
    const a = unwrap(Money.create(100, eur()));
    const b = unwrap(Money.create(50, eur()));
    expect(unwrap(a.isGreaterThan(b))).toBe(true);
    expect(unwrap(a.isLessThan(b))).toBe(false);
    expect(unwrap(a.equals(unwrap(Money.create(100, eur()))))).toBe(true);
  });

  it("comparison across currencies fails", () => {
    const a = unwrap(Money.create(100, eur()));
    const b = unwrap(Money.create(100, usd()));
    expect(a.equals(b).success).toBe(false);
    expect(a.isGreaterThan(b).success).toBe(false);
  });

  it("toString uses currency symbol and decimals", () => {
    expect(unwrap(Money.create(100, eur())).toString()).toBe("€100.00");
    // JPY is a zero-decimal currency, so no fractional digits are rendered.
    expect(unwrap(Money.create(100, unwrap(Currency.create("JPY")))).toString()).toBe("¥100");
  });
});

describe("CreditRating", () => {
  it("creates from an S&P code", () => {
    const r = unwrap(CreditRating.create("AAA"));
    expect(r.code).toBe(1);
    expect(r.sp).toBe("AAA");
    expect(r.moodys).toBe("Aaa");
    expect(r.fitch).toBe("AAA");
  });

  it("maps across all three agencies for a given numeric code", () => {
    const r = CreditRating.fromNumeric(9)!;
    expect(r.sp).toBe("BBB");
    expect(r.moodys).toBe("Baa2");
    expect(r.fitch).toBe("BBB");
  });

  it("creates from a Moody's code regardless of case", () => {
    // create() normalises both sides, so mixed-case Moody's codes resolve.
    const r = unwrap(CreditRating.create("Baa2"));
    expect(r.code).toBe(9);
    expect(r.moodys).toBe("Baa2");
    expect(r.sp).toBe("BBB");
    // case-insensitive on input
    expect(CreditRating.create("baa2").success).toBe(true);
    expect(CreditRating.create("AAA").success).toBe(true);
  });

  it("is case-insensitive on input", () => {
    const r = unwrap(CreditRating.create("bbb"));
    expect(r.sp).toBe("BBB");
  });

  it("rejects unknown ratings", () => {
    const res = CreditRating.create("ZZZ");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("ZZZ");
  });

  it("fromNumeric returns a rating for valid codes", () => {
    const r = CreditRating.fromNumeric(21);
    expect(r).toBeDefined();
    expect(r?.sp).toBe("D");
    expect(r?.moodys).toBe("C");
  });

  it("fromNumeric returns undefined for out-of-range or non-integer codes", () => {
    expect(CreditRating.fromNumeric(-1)).toBeUndefined();
    expect(CreditRating.fromNumeric(22)).toBeUndefined();
    expect(CreditRating.fromNumeric(1.5)).toBeUndefined();
  });

  it("code 0 is Not Rated", () => {
    const r = CreditRating.fromNumeric(0);
    expect(r?.sp).toBe("Not Rated");
  });

  it("equals compares by numeric code", () => {
    expect(unwrap(CreditRating.create("AAA")).equals(CreditRating.fromNumeric(1)!)).toBe(true);
    expect(unwrap(CreditRating.create("AAA")).equals(unwrap(CreditRating.create("BBB")))).toBe(false);
  });
});

describe("UTCDate", () => {
  it("parses a valid ISO YYYY-MM-DD string", () => {
    const d = unwrap(UTCDate.fromString("2026-05-28"));
    expect(d.year).toBe(2026);
    expect(d.month).toBe(4); // 0-indexed -> May
    expect(d.day).toBe(28);
  });

  it("rejects malformed strings", () => {
    expect(UTCDate.fromString("2026/05/28").success).toBe(false);
    expect(UTCDate.fromString("28-05-2026").success).toBe(false);
    expect(UTCDate.fromString("not-a-date").success).toBe(false);
    expect(UTCDate.fromString("").success).toBe(false);
  });

  it("rejects calendar-invalid components (Feb 30)", () => {
    expect(UTCDate.fromComponents(2026, 1, 30).success).toBe(false);
  });

  it("rejects out-of-range month/day", () => {
    expect(UTCDate.fromComponents(2026, 12, 1).success).toBe(false);
    expect(UTCDate.fromComponents(2026, 0, 0).success).toBe(false);
    expect(UTCDate.fromComponents(2026, 5, 1.5).success).toBe(false);
  });

  it("fromComponents builds the expected date", () => {
    const d = unwrap(UTCDate.fromComponents(2024, 1, 29)); // Feb 29 2024
    expect(d.toISOString()).toBe("2024-02-29");
  });

  it("computes day of week correctly", () => {
    // 2026-05-28 is a Thursday -> getUTCDay() === 4
    expect(unwrap(UTCDate.fromString("2026-05-28")).dayOfWeek).toBe(4);
    // 2026-05-31 is a Sunday -> 0
    expect(unwrap(UTCDate.fromString("2026-05-31")).dayOfWeek).toBe(0);
  });

  it("identifies leap years", () => {
    expect(unwrap(UTCDate.fromString("2024-01-01")).isLeapYear()).toBe(true);
    expect(unwrap(UTCDate.fromString("2026-01-01")).isLeapYear()).toBe(false);
    expect(unwrap(UTCDate.fromString("2000-01-01")).isLeapYear()).toBe(true);
    expect(unwrap(UTCDate.fromString("1900-01-01")).isLeapYear()).toBe(false);
  });

  it("daysInMonth handles February in leap vs non-leap years", () => {
    expect(unwrap(UTCDate.fromString("2024-02-15")).daysInMonth()).toBe(29);
    expect(unwrap(UTCDate.fromString("2026-02-15")).daysInMonth()).toBe(28);
    expect(unwrap(UTCDate.fromString("2026-04-15")).daysInMonth()).toBe(30);
  });

  it("daysInYear reflects leap years", () => {
    expect(unwrap(UTCDate.fromString("2024-06-01")).daysInYear()).toBe(366);
    expect(unwrap(UTCDate.fromString("2026-06-01")).daysInYear()).toBe(365);
  });

  it("comparison helpers order dates correctly", () => {
    const a = unwrap(UTCDate.fromString("2026-01-01"));
    const b = unwrap(UTCDate.fromString("2026-12-31"));
    expect(a.isBefore(b)).toBe(true);
    expect(b.isAfter(a)).toBe(true);
    expect(a.isSameOrBefore(unwrap(UTCDate.fromString("2026-01-01")))).toBe(true);
    expect(a.equals(unwrap(UTCDate.fromString("2026-01-01")))).toBe(true);
  });

  it("daysUntil counts calendar days", () => {
    const a = unwrap(UTCDate.fromString("2026-01-01"));
    const b = unwrap(UTCDate.fromString("2026-01-11"));
    expect(a.daysUntil(b)).toBe(10);
    expect(b.daysUntil(a)).toBe(-10);
  });

  it("diffMonths counts month differences", () => {
    const a = unwrap(UTCDate.fromString("2026-01-15"));
    const b = unwrap(UTCDate.fromString("2026-07-15"));
    expect(a.diffMonths(b)).toBe(6);
  });

  it("addMonths protects against month-end rollover", () => {
    // Jan 31 + 1 month should clamp to Feb 28 (2026 non-leap), not Mar 3
    const jan31 = unwrap(UTCDate.fromString("2026-01-31"));
    expect(unwrap(jan31.addMonths(1)).toISOString()).toBe("2026-02-28");
  });

  it("addDays crosses month and year boundaries", () => {
    const d = unwrap(UTCDate.fromString("2026-12-31"));
    expect(unwrap(d.addDays(1)).toISOString()).toBe("2027-01-01");
  });

  it("startOfMonth and endOfMonth", () => {
    const d = unwrap(UTCDate.fromString("2024-02-15"));
    expect(unwrap(d.startOfMonth()).toISOString()).toBe("2024-02-01");
    expect(unwrap(d.endOfMonth()).toISOString()).toBe("2024-02-29");
  });

  it("isWeekend detects Saturday and Sunday", () => {
    expect(unwrap(UTCDate.fromString("2026-05-30")).isWeekend()).toBe(true); // Sat
    expect(unwrap(UTCDate.fromString("2026-05-31")).isWeekend()).toBe(true); // Sun
    expect(unwrap(UTCDate.fromString("2026-05-28")).isWeekend()).toBe(false); // Thu
  });

  it("toISOString roundtrips through fromString", () => {
    const iso = "2026-05-28";
    expect(unwrap(UTCDate.fromString(iso)).toISOString()).toBe(iso);
  });
});
