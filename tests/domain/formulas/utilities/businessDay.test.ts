import { describe, it, expect } from "vitest";
import { UTCDate } from "@domain/valueObjects";
import {
  isBusinessDay,
  addBusinessDays,
  countBusinessDays,
  getNextBusinessDay,
  getPreviousBusinessDay,
  adjustForBusinessDay,
  getCalendarHolidays,
  getHolidaysForYear,
  getCalendarMetadata,
} from "@domain/formulas/utilities/businessDayAdjustment";
import { adjustSettlement } from "@domain/formulas/utilities/adjustSettlement";
import { unwrap } from "../../../helpers/result";

// Build a UTCDate from a YYYY-MM-DD string, asserting success.
function d(iso: string): UTCDate {
  return unwrap(UTCDate.fromString(iso));
}

describe("isBusinessDay", () => {
  it("returns false for a Saturday (known weekend)", () => {
    // 2026-01-17 is a Saturday.
    expect(isBusinessDay(d("2026-01-17"), "WEEKEND_ONLY")).toBe(false);
    expect(isBusinessDay(d("2026-01-17"), "EUREX")).toBe(false);
  });

  it("returns false for a Sunday (known weekend)", () => {
    // 2026-01-18 is a Sunday.
    expect(isBusinessDay(d("2026-01-18"), "WEEKEND_ONLY")).toBe(false);
  });

  it("returns true for an ordinary weekday", () => {
    // 2026-01-20 is a Tuesday and not a holiday in these calendars.
    expect(isBusinessDay(d("2026-01-20"), "WEEKEND_ONLY")).toBe(true);
    expect(isBusinessDay(d("2026-01-20"), "EUREX")).toBe(true);
    expect(isBusinessDay(d("2026-01-20"), "TARGET")).toBe(true);
  });

  it("treats Christmas 2026-12-25 as a holiday for EUREX and TARGET", () => {
    // 2026-12-25 is a Friday but a market holiday on both calendars.
    const christmas = d("2026-12-25");
    expect(isBusinessDay(christmas, "EUREX")).toBe(false);
    expect(isBusinessDay(christmas, "TARGET")).toBe(false);
    // WEEKEND_ONLY has no holidays, so a Friday remains a business day.
    expect(isBusinessDay(christmas, "WEEKEND_ONLY")).toBe(true);
  });
});

describe("getCalendarHolidays / getHolidaysForYear", () => {
  it("returns the configured EUREX 2026 holidays sorted ascending", () => {
    const holidays = getCalendarHolidays("EUREX", 2026);
    expect(holidays).toContain("2026-12-25");
    expect(holidays).toContain("2026-01-01");
    // Verify sorted ascending (ISO strings sort chronologically).
    const sorted = [...holidays].sort();
    expect(holidays).toEqual(sorted);
  });

  it("returns an empty array for a year outside the loaded range", () => {
    expect(getCalendarHolidays("EUREX", 1900)).toEqual([]);
  });

  it("getHolidaysForYear yields UTCDate objects matching the string list", () => {
    const strings = getCalendarHolidays("TARGET", 2026);
    const dates = unwrap(getHolidaysForYear(2026, "TARGET"));
    expect(dates.map((x) => x.toISOString()).sort()).toEqual(strings);
  });
});

describe("adjustForBusinessDay", () => {
  it("UNADJUSTED leaves a non-business day untouched", () => {
    // 2026-01-17 Saturday stays put.
    const adjusted = unwrap(
      adjustForBusinessDay(d("2026-01-17"), "UNADJUSTED", "WEEKEND_ONLY")
    );
    expect(adjusted.toISOString()).toBe("2026-01-17");
  });

  it("returns the same date when it is already a business day", () => {
    const adjusted = unwrap(
      adjustForBusinessDay(d("2026-01-20"), "FOLLOWING", "WEEKEND_ONLY")
    );
    expect(adjusted.toISOString()).toBe("2026-01-20");
  });

  it("FOLLOWING rolls a Saturday forward to the next Monday", () => {
    // 2026-01-17 Sat -> 2026-01-19 Mon.
    const adjusted = unwrap(
      adjustForBusinessDay(d("2026-01-17"), "FOLLOWING", "WEEKEND_ONLY")
    );
    expect(adjusted.toISOString()).toBe("2026-01-19");
  });

  it("PRECEDING rolls a Saturday backward to the prior Friday", () => {
    // 2026-01-17 Sat -> 2026-01-16 Fri.
    const adjusted = unwrap(
      adjustForBusinessDay(d("2026-01-17"), "PRECEDING", "WEEKEND_ONLY")
    );
    expect(adjusted.toISOString()).toBe("2026-01-16");
  });

  it("MODIFIED_FOLLOWING rolls back when FOLLOWING would cross a month boundary", () => {
    // EUREX 2026-12-31 (Thu) is a holiday. FOLLOWING would skip
    // 2026-12-31 (holiday) -> 2027-01-01 (holiday) -> 2027-01-02/03 (weekend)
    // -> 2027-01-04 (Mon), crossing into January. MODIFIED_FOLLOWING must
    // instead step backward to the last business day in December: 2026-12-30 (Wed).
    const following = unwrap(
      adjustForBusinessDay(d("2026-12-31"), "FOLLOWING", "EUREX")
    );
    expect(following.toISOString()).toBe("2027-01-04");

    const modFollowing = unwrap(
      adjustForBusinessDay(d("2026-12-31"), "MODIFIED_FOLLOWING", "EUREX")
    );
    expect(modFollowing.toISOString()).toBe("2026-12-30");
  });
});

describe("addBusinessDays / getNextBusinessDay / getPreviousBusinessDay", () => {
  it("defaults to the WEEKEND_ONLY calendar", () => {
    // From Friday 2026-01-16, +1 business day -> Monday 2026-01-19.
    const next = unwrap(addBusinessDays(d("2026-01-16"), 1));
    expect(next.toISOString()).toBe("2026-01-19");
  });

  it("skips weekends when adding business days", () => {
    // Tuesday 2026-01-20 + 5 business days -> Tuesday 2026-01-27.
    const result = unwrap(addBusinessDays(d("2026-01-20"), 5, "WEEKEND_ONLY"));
    expect(result.toISOString()).toBe("2026-01-27");
  });

  it("skips holidays in addition to weekends", () => {
    // Wednesday 2026-12-23 + 1 business day on EUREX must skip the
    // 2026-12-24 and 2026-12-25 holidays -> 2026-12-28 (Mon).
    const result = unwrap(addBusinessDays(d("2026-12-23"), 1, "EUREX"));
    expect(result.toISOString()).toBe("2026-12-28");
  });

  it("moves backward for negative day counts", () => {
    // Monday 2026-01-19 - 1 business day -> Friday 2026-01-16.
    const result = unwrap(addBusinessDays(d("2026-01-19"), -1, "WEEKEND_ONLY"));
    expect(result.toISOString()).toBe("2026-01-16");
  });

  it("rejects a non-integer day count", () => {
    const result = addBusinessDays(d("2026-01-20"), 1.5, "WEEKEND_ONLY");
    expect(result.success).toBe(false);
  });

  it("getNextBusinessDay / getPreviousBusinessDay are inverse over a weekday gap", () => {
    const next = unwrap(getNextBusinessDay(d("2026-01-20"), "WEEKEND_ONLY"));
    expect(next.toISOString()).toBe("2026-01-21");
    const prev = unwrap(getPreviousBusinessDay(next, "WEEKEND_ONLY"));
    expect(prev.toISOString()).toBe("2026-01-20");
  });
});

describe("countBusinessDays", () => {
  it("counts only weekdays over a full calendar week (start inclusive, end exclusive)", () => {
    // Monday 2026-01-19 .. Monday 2026-01-26 -> Mon..Fri = 5 business days.
    const count = countBusinessDays(
      d("2026-01-19"),
      d("2026-01-26"),
      "WEEKEND_ONLY"
    );
    expect(count).toBe(5);
  });

  it("excludes holidays in the span", () => {
    // 2026-12-21 (Mon) .. 2026-12-28 (Mon) on EUREX: weekdays are 21,22,23,24,25;
    // 24 and 25 are holidays, leaving 21,22,23 = 3 business days.
    const count = countBusinessDays(
      d("2026-12-21"),
      d("2026-12-28"),
      "EUREX"
    );
    expect(count).toBe(3);
  });

  it("returns 0 when start equals end", () => {
    expect(
      countBusinessDays(d("2026-01-20"), d("2026-01-20"), "WEEKEND_ONLY")
    ).toBe(0);
  });
});

describe("getCalendarMetadata", () => {
  it("exposes the loaded calendar list and year range", () => {
    const meta = getCalendarMetadata();
    expect(meta.availableCalendars).toContain("EUREX");
    expect(meta.availableCalendars).toContain("WEEKEND_ONLY");
    expect(meta.startYear).toBeLessThanOrEqual(2026);
    expect(meta.endYear).toBeGreaterThanOrEqual(2026);
  });
});

describe("adjustSettlement", () => {
  it("fails when the proposed settlement is on or after maturity", () => {
    const result = adjustSettlement(
      d("2030-01-01"),
      d("2020-01-01"),
      d("2030-01-01")
    );
    expect(result.success).toBe(false);
  });

  it("returns the proposed date when it is valid and after issue", () => {
    const settled = unwrap(
      adjustSettlement(d("2026-06-01"), d("2020-01-01"), d("2030-01-01"))
    );
    expect(settled.toISOString()).toBe("2026-06-01");
  });

  it("rolls forward to the earliest settlement for a pre-IPO bond", () => {
    // Issue 2026-06-01 (Mon) + 2 business days = 2026-06-03; a settlement
    // proposed on issue date itself must move to the earliest allowed date.
    const settled = unwrap(
      adjustSettlement(
        d("2026-06-01"),
        d("2026-06-01"),
        d("2030-01-01"),
        2,
        "WEEKEND_ONLY"
      )
    );
    expect(settled.toISOString()).toBe("2026-06-03");
  });
});
