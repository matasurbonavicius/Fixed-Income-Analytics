import { describe, it, expect } from "vitest";
import { UTCDate } from "@domain/valueObjects";
import {
  generateCouponSchedule,
  getNextCouponDate,
  getLastCouponDate,
  getFutureCoupons,
  getCurrentCouponPeriod,
  GenerateCouponScheduleInput,
  CouponPayment,
} from "@domain/formulas/utilities/scheduleGenerator";
import { unwrap } from "../../helpers/result";

// Build a UTCDate from a YYYY-MM-DD string, asserting success.
function d(iso: string): UTCDate {
  return unwrap(UTCDate.fromString(iso));
}

// A 5-year bond whose every anniversary falls on a weekday under UNADJUSTED,
// so payment dates are predictable.
function buildSchedule(
  overrides: Partial<GenerateCouponScheduleInput> = {}
): CouponPayment[] {
  const input: GenerateCouponScheduleInput = {
    issueDate: d("2026-01-15"),
    maturityDate: d("2031-01-15"),
    frequency: 1,
    businessDayConvention: "UNADJUSTED",
    calendar: "WEEKEND_ONLY",
    ...overrides,
  };
  return unwrap(generateCouponSchedule(input));
}

describe("generateCouponSchedule", () => {
  it("produces one coupon per year for an annual schedule", () => {
    const schedule = buildSchedule({ frequency: 1 });
    // 2026..2031 inclusive of maturity -> 5 annual payments.
    expect(schedule).toHaveLength(5);
  });

  it("produces two coupons per year for a semi-annual schedule", () => {
    const schedule = buildSchedule({ frequency: 2 });
    expect(schedule).toHaveLength(10);
  });

  it("produces an empty schedule for a zero-coupon bond (frequency 0)", () => {
    const schedule = buildSchedule({ frequency: 0 });
    expect(schedule).toEqual([]);
  });

  it("returns coupon payment dates in strictly increasing order", () => {
    const schedule = buildSchedule({ frequency: 2 });
    for (let i = 1; i < schedule.length; i++) {
      expect(
        schedule[i].paymentDate.isAfter(schedule[i - 1].paymentDate)
      ).toBe(true);
    }
  });

  it("ends with a payment on the maturity date (UNADJUSTED)", () => {
    const schedule = buildSchedule({ frequency: 1 });
    const last = schedule[schedule.length - 1];
    expect(last.paymentDate.toISOString()).toBe("2031-01-15");
    expect(last.periodEndDate.toISOString()).toBe("2031-01-15");
  });

  it("first period starts at the issue date", () => {
    const schedule = buildSchedule({ frequency: 1 });
    expect(schedule[0].periodStartDate.toISOString()).toBe("2026-01-15");
  });

  it("chains periods so each period starts where the previous ended", () => {
    const schedule = buildSchedule({ frequency: 2 });
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].periodStartDate.toISOString()).toBe(
        schedule[i - 1].periodEndDate.toISOString()
      );
    }
  });

  it("rolls a payment landing on a weekend under FOLLOWING", () => {
    // The 2028-01-15 anniversary is a Saturday; FOLLOWING moves it to Monday.
    const schedule = buildSchedule({ frequency: 1, businessDayConvention: "FOLLOWING" });
    const jan2028 = schedule.find(
      (c) => c.periodEndDate.toISOString() === "2028-01-15"
    );
    expect(jan2028).toBeDefined();
    expect(jan2028!.paymentDate.toISOString()).toBe("2028-01-17");
  });
});

describe("getNextCouponDate / getLastCouponDate", () => {
  const schedule = buildSchedule({ frequency: 1 }); // payments on each 01-15

  it("are consistent around a mid-period settlement date (last < settlement <= next)", () => {
    const settlement = d("2028-06-15");
    const last = getLastCouponDate(schedule, settlement);
    const next = getNextCouponDate(schedule, settlement);
    expect(last).not.toBeNull();
    expect(next).not.toBeNull();
    expect(last!.isBefore(settlement)).toBe(true);
    expect(next!.isSameOrAfter(settlement)).toBe(true);
    expect(last!.isBefore(next!)).toBe(true);
    // Specifically the surrounding annual coupons.
    expect(last!.toISOString()).toBe("2028-01-15");
    expect(next!.toISOString()).toBe("2029-01-15");
  });

  it("getLastCouponDate is null before the first coupon", () => {
    const settlement = d("2026-03-01");
    expect(getLastCouponDate(schedule, settlement)).toBeNull();
    expect(getNextCouponDate(schedule, settlement)).not.toBeNull();
  });

  it("getNextCouponDate is null on/after the final coupon", () => {
    const settlement = d("2031-01-15"); // final coupon, isAfter is false
    expect(getNextCouponDate(schedule, settlement)).toBeNull();
    expect(getLastCouponDate(schedule, settlement)).not.toBeNull();
  });

  it("a coupon payment date counts as 'last' (isSameOrBefore), not 'next'", () => {
    const onCoupon = d("2029-01-15");
    expect(getLastCouponDate(schedule, onCoupon)!.toISOString()).toBe(
      "2029-01-15"
    );
    // The same date is excluded from 'next' (strict isAfter).
    expect(getNextCouponDate(schedule, onCoupon)!.toISOString()).toBe(
      "2030-01-15"
    );
  });
});

describe("getFutureCoupons", () => {
  const schedule = buildSchedule({ frequency: 1 });

  it("returns only coupons strictly after settlement, in order", () => {
    const future = getFutureCoupons(schedule, d("2028-06-15"));
    // Remaining: 2029, 2030, 2031.
    expect(future).toHaveLength(3);
    expect(future[0].paymentDate.toISOString()).toBe("2029-01-15");
    expect(future[future.length - 1].paymentDate.toISOString()).toBe(
      "2031-01-15"
    );
  });

  it("returns all coupons when settlement precedes issue", () => {
    expect(getFutureCoupons(schedule, d("2025-01-01"))).toHaveLength(5);
  });
});

describe("getCurrentCouponPeriod", () => {
  it("identifies the period bracketing the settlement date", () => {
    const schedule = buildSchedule({ frequency: 1 });
    const period = getCurrentCouponPeriod(schedule, d("2028-06-15"));
    expect(period).not.toBeNull();
    expect(period!.periodStartDate.toISOString()).toBe("2028-01-15");
    expect(period!.periodEndDate.toISOString()).toBe("2029-01-15");
  });
});
