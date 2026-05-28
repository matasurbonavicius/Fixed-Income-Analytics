import { describe, it, expect } from "vitest";
import { UTCDate } from "@domain/valueObjects";
import {
  dayCountFraction,
  dayCountDays,
  DayCountConvention,
} from "@domain/formulas/utilities/dayCountConventions";

// Build a UTCDate from a YYYY-MM-DD string, asserting success.
function d(iso: string): UTCDate {
  const result = UTCDate.fromString(iso);
  if (!result.success) {
    throw new Error(`bad test date ${iso}: ${result.error}`);
  }
  return result.value;
}

function df(start: string, end: string, conv: DayCountConvention): number {
  return dayCountFraction(d(start), d(end), conv);
}

const PREC = 9; // toBeCloseTo digits

describe("dayCountFraction — Actual/* family", () => {
  // 2021-01-01 → 2021-07-01 is a non-leap interval of 181 days.
  const A_START = "2021-01-01";
  const A_END = "2021-07-01";
  const A_DAYS = 181;

  it("ACT/360 = days / 360", () => {
    expect(df(A_START, A_END, "ACT_360")).toBeCloseTo(A_DAYS / 360, PREC);
  });

  it("ACT/365 Fixed = days / 365", () => {
    expect(df(A_START, A_END, "ACT_365")).toBeCloseTo(A_DAYS / 365, PREC);
  });

  it("ACT/364 = days / 364", () => {
    expect(df(A_START, A_END, "ACT_364")).toBeCloseTo(A_DAYS / 364, PREC);
  });

  it("ACT/366 = days / 366", () => {
    expect(df(A_START, A_END, "ACT_366")).toBeCloseTo(A_DAYS / 366, PREC);
  });

  it("ACT/ACT ISDA: a full leap year = 1.0", () => {
    expect(df("2020-01-01", "2021-01-01", "ACT_ACT")).toBeCloseTo(1, PREC);
  });

  it("ACT/ACT ISDA: a full common year = 1.0", () => {
    expect(df("2021-01-01", "2022-01-01", "ACT_ACT")).toBeCloseTo(1, PREC);
  });

  it("ACT/ACT ISDA: intra leap year divides by 366", () => {
    // 2020-02-01 → 2020-03-01 = 29 actual days, 2020 is leap → /366
    expect(df("2020-02-01", "2020-03-01", "ACT_ACT")).toBeCloseTo(29 / 366, PREC);
  });
});

describe("dayCountFraction — NL/365 (No Leap)", () => {
  it("drops a single leap day from the numerator", () => {
    // 2020-02-01 → 2020-03-01 = 29 actual days, one of which is 29 Feb → 28/365
    expect(df("2020-02-01", "2020-03-01", "NL_365")).toBeCloseTo(28 / 365, PREC);
  });

  it("a full leap year = 365/365 = 1.0 (leap day removed)", () => {
    expect(df("2020-01-01", "2021-01-01", "NL_365")).toBeCloseTo(1, PREC);
  });

  it("equals ACT/365 when no 29 Feb is in the period", () => {
    expect(df("2021-01-01", "2021-07-01", "NL_365")).toBeCloseTo(181 / 365, PREC);
  });
});

describe("dayCountFraction — Actual/Actual AFB", () => {
  it("matches the Wikipedia example 1994-02-10 → 1997-06-30 = 3 + 140/365", () => {
    expect(df("1994-02-10", "1997-06-30", "ACT_ACT_AFB")).toBeCloseTo(
      3 + 140 / 365,
      PREC
    );
  });

  it("uses a 366 denominator when 29 Feb falls in a sub-year stub", () => {
    // 2016-02-10 → 2016-06-30: < 1 year, 2016 leap, period contains 29 Feb
    // = 141 actual days / 366
    expect(df("2016-02-10", "2016-06-30", "ACT_ACT_AFB")).toBeCloseTo(
      141 / 366,
      PREC
    );
  });

  it("a full year contributes exactly 1.0", () => {
    expect(df("2021-06-30", "2022-06-30", "ACT_ACT_AFB")).toBeCloseTo(1, PREC);
  });
});

describe("dayCountFraction — 30/360 family (variant-distinguishing cases)", () => {
  // 2007-02-28 → 2007-03-31 separates all three 30/360 variants:
  //   Bond Basis: 33/360   30E/360: 32/360   US NASD: 30/360
  const START = "2007-02-28";
  const END = "2007-03-31";

  it("30/360 Bond Basis (30_360_US) → 33/360", () => {
    expect(df(START, END, "30_360_US")).toBeCloseTo(33 / 360, PREC);
  });

  it("30E/360 (30_360_EU) → 32/360", () => {
    expect(df(START, END, "30_360_EU")).toBeCloseTo(32 / 360, PREC);
  });

  it("30/360 US NASD (30_360_NASD) → 30/360 (February EOM rules)", () => {
    expect(df(START, END, "30_360_NASD")).toBeCloseTo(30 / 360, PREC);
  });

  it("all 30/360 variants agree on a plain month (2007-01-15 → 2007-02-15 = 30/360)", () => {
    expect(df("2007-01-15", "2007-02-15", "30_360_US")).toBeCloseTo(30 / 360, PREC);
    expect(df("2007-01-15", "2007-02-15", "30_360_EU")).toBeCloseTo(30 / 360, PREC);
    expect(df("2007-01-15", "2007-02-15", "30_360_NASD")).toBeCloseTo(30 / 360, PREC);
  });

  it("31st-day adjustment: 2007-01-31 → 2007-03-31 = 60/360 in all 30/360 variants", () => {
    expect(df("2007-01-31", "2007-03-31", "30_360_US")).toBeCloseTo(60 / 360, PREC);
    expect(df("2007-01-31", "2007-03-31", "30_360_EU")).toBeCloseTo(60 / 360, PREC);
    expect(df("2007-01-31", "2007-03-31", "30_360_NASD")).toBeCloseTo(60 / 360, PREC);
  });
});

describe("dayCountFraction — non-standard & trivial", () => {
  it("30/366 = 30E-style numerator over 366", () => {
    // 2007-02-28 → 2007-03-31: 30E/360 numerator is 32 → 32/366
    expect(df("2007-02-28", "2007-03-31", "30_366")).toBeCloseTo(32 / 366, PREC);
  });

  it("1/1 always returns 1.0 regardless of dates", () => {
    expect(df("2021-01-01", "2021-07-01", "1_1")).toBe(1);
    expect(df("2020-03-15", "2027-11-02", "1_1")).toBe(1);
  });
});

describe("dayCountDays — convention-counted days vs calendar days", () => {
  // The reported case: 2026-05-01 → 2026-05-31 is 30 calendar days, but 30E/360
  // counts 29 (it pulls the 31st down to the 30th).
  const START = "2026-05-01";
  const END = "2026-05-31";

  function calendarDays(start: string, end: string): number {
    return d(start).daysUntil(d(end));
  }

  it("30E/360 counts 29 even though the calendar gap is 30", () => {
    expect(calendarDays(START, END)).toBe(30);
    expect(dayCountDays(d(START), d(END), "30_360_EU")).toBe(29);
  });

  it("30/360 Bond Basis counts 30 here (start day 1 < 30, so 31 is not reduced)", () => {
    expect(dayCountDays(d(START), d(END), "30_360_US")).toBe(30);
  });

  it("ACT/* count the true calendar gap (no day adjustment)", () => {
    for (const c of ["ACT_360", "ACT_365", "ACT_364", "ACT_366", "ACT_ACT"] as const) {
      expect(dayCountDays(d(START), d(END), c)).toBe(30);
    }
  });

  it("NL/365 drops a 29 February from the count", () => {
    // 2020-02-01 → 2020-03-01: 29 calendar days, one is 29 Feb → counts 28
    expect(calendarDays("2020-02-01", "2020-03-01")).toBe(29);
    expect(dayCountDays(d("2020-02-01"), d("2020-03-01"), "NL_365")).toBe(28);
  });

  it("adjusted days = round(fraction × basis) stays consistent with the fraction", () => {
    // 30E/360 fraction × 360 must equal the counted days
    expect(Math.round(dayCountFraction(d(START), d(END), "30_360_EU") * 360)).toBe(
      dayCountDays(d(START), d(END), "30_360_EU")
    );
  });
});

describe("dayCountFraction — guards", () => {
  it("throws on an unsupported convention", () => {
    expect(() =>
      dayCountFraction(d("2021-01-01"), d("2021-07-01"), "BOGUS" as DayCountConvention)
    ).toThrow(/Unsupported day count convention/);
  });
});
