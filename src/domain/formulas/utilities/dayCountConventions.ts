import { UTCDate } from "@domain/valueObjects";

// Calculate the number of actual days between two dates (inclusive of start, exclusive of end)
function actualDays(startDate: UTCDate, endDate: UTCDate): number {
  return startDate.daysUntil(endDate);
}

// True when `date` is the last calendar day of February (28th in a common
// year, 29th in a leap year). Used by the 30/360 US end-of-month rules.
function isLastDayOfFebruary(date: UTCDate): boolean {
  return date.month === 1 && date.day === date.daysInMonth();
}

// Count the number of 29-February dates falling in [start, end) (start
// inclusive, end exclusive - matching `actualDays`). Used by NL/365.
function countLeapDays(start: UTCDate, end: UTCDate): number {
  let count = 0;
  for (let year = start.year; year <= end.year; year++) {
    const feb29Result = UTCDate.fromComponents(year, 1, 29); // 29 Feb (fails in non-leap years)
    if (!feb29Result.success) {
      continue; // not a leap year
    }
    const feb29 = feb29Result.value;
    // start <= feb29 < end
    if (start.daysUntil(feb29) >= 0 && feb29.daysUntil(end) > 0) {
      count++;
    }
  }
  return count;
}

// Subtract whole calendar years from a date, clamping 29 Feb to 28 Feb when
// the target year is not a leap year. Used by the Actual/Actual AFB year split.
function subtractYears(date: UTCDate, years: number): UTCDate {
  const targetYear = date.year - years;
  const direct = UTCDate.fromComponents(targetYear, date.month, date.day);
  if (direct.success) {
    return direct.value;
  }
  // The only valid date that can fail is 29 Feb landing on a non-leap year.
  const clamped = UTCDate.fromComponents(targetYear, date.month, 28);
  if (!clamped.success) {
    throw new Error(`Failed to subtract years from date: ${clamped.error}`);
  }
  return clamped.value;
}

/**
 * Actual/360 (Act/360, "French")
 * Actual days / 360.
 *
 * Money-market standard (USD/EUR deposits, repos). Slightly inflates interest
 * versus Actual/365 because the year is treated as only 360 days long.
 */
function calculate_ACT_360(startDate: UTCDate, endDate: UTCDate): number {
  const days = actualDays(startDate, endDate);
  return days / 360;
}

/**
 * Actual/365 Fixed (Act/365F, "English")
 * Actual days / 365 (always, regardless of leap year).
 *
 * Simple and predictable. Used in UK gilts and some corporate bonds.
 */
function calculate_ACT_365(startDate: UTCDate, endDate: UTCDate): number {
  const days = actualDays(startDate, endDate);
  return days / 365;
}

/**
 * Actual/364 (Act/364)
 * Actual days / 364.
 *
 * Used for some interest-rate products whose periods are whole numbers of
 * weeks (364 = 52 × 7).
 */
function calculate_ACT_364(startDate: UTCDate, endDate: UTCDate): number {
  const days = actualDays(startDate, endDate);
  return days / 364;
}

/**
 * Actual/366 (NON-STANDARD)
 * Actual days / 366 (always).
 *
 * Not a recognised market convention - included as a fixed leap-year-length
 * basis alongside Actual/365 Fixed. Slightly deflates the fraction versus
 * Actual/365 Fixed.
 */
function calculate_ACT_366(startDate: UTCDate, endDate: UTCDate): number {
  const days = actualDays(startDate, endDate);
  return days / 366;
}

/**
 * NL/365 ("No Leap" / Actual/365 No-Leap)
 * (Actual days − any 29 February in the period) / 365.
 *
 * Behaves like Actual/365 Fixed but explicitly drops leap days from the
 * numerator, so a full common year and a full leap year both yield 1.0.
 */
function calculate_NL_365(startDate: UTCDate, endDate: UTCDate): number {
  const days = actualDays(startDate, endDate) - countLeapDays(startDate, endDate);
  return days / 365;
}

/**
 * Actual/Actual (ISDA)  - aka Act/Act, Act/365
 * Splits the period at calendar-year boundaries: days falling in a common year
 * are divided by 365, days in a leap year by 366, and the two are summed.
 *
 *   factor = (days in common years / 365) + (days in leap years / 366)
 *
 * Most accurate "actual" basis. Used for US Treasuries and many government bonds.
 */
function calculate_ACT_ACT(startDate: UTCDate, endDate: UTCDate): number {
  if (startDate.year === endDate.year) {
    // Same year - simple calculation
    const days = actualDays(startDate, endDate);
    const yearDays = startDate.daysInYear();
    return days / yearDays;
  }

  // Different years - need to split
  let fraction = 0;
  let current = startDate.clone();

  while (current.year < endDate.year) {
    // Days remaining in current year (until Dec 31, inclusive)
    const yearEndResult = UTCDate.fromComponents(current.year, 11, 31);
    if (!yearEndResult.success) {
      throw new Error(`Failed to create year end date: ${yearEndResult.error}`);
    }
    const yearEnd = yearEndResult.value;

    const daysInCurrentYear = current.daysUntil(yearEnd) + 1; // +1 to include Dec 31
    const totalDaysInYear = current.daysInYear();
    fraction += daysInCurrentYear / totalDaysInYear;

    // Move to next year (Jan 1)
    const nextYearResult = UTCDate.fromComponents(current.year + 1, 0, 1);
    if (!nextYearResult.success) {
      throw new Error(`Failed to create next year date: ${nextYearResult.error}`);
    }
    current = nextYearResult.value;
  }

  // Add days in final year
  const daysInFinalYear = current.daysUntil(endDate);
  const totalDaysInFinalYear = endDate.daysInYear();
  fraction += daysInFinalYear / totalDaysInFinalYear;

  return fraction;
}

/**
 * Actual/Actual (AFB)  - Association Française des Banques
 * Count complete years backward from the end date; each contributes 1.0. The
 * remaining stub is `stub days / DiY`, where DiY = 366 when a 29 February falls
 * inside the stub (start inclusive, end exclusive) and 365 otherwise.
 *
 *   factor = wholeYears + (stub days / DiY)
 *
 * Example (Wikipedia): 1994-02-10 → 1997-06-30 = 3 + 140/365.
 */
function calculate_ACT_ACT_AFB(startDate: UTCDate, endDate: UTCDate): number {
  // Peel off whole years from the end of the period.
  let wholeYears = 0;
  let stubEnd = endDate;
  while (true) {
    const candidate = subtractYears(endDate, wholeYears + 1);
    // Keep peeling while the candidate stays on or after the start date.
    if (startDate.daysUntil(candidate) >= 0) {
      wholeYears++;
      stubEnd = candidate;
    } else {
      break;
    }
  }

  const stubDays = actualDays(startDate, stubEnd);
  const diy = countLeapDays(startDate, stubEnd) > 0 ? 366 : 365;
  return wholeYears + stubDays / diy;
}

/**
 * 30/360 Bond Basis (30A/360)  - exposed in the UI as "30/360 US"
 * Assumes 30-day months and a 360-day year, with the simplest end-of-month rules:
 *   D1 = min(D1, 30)
 *   if D1 was 30 or 31 (i.e. > 29): D2 = min(D2, 30)
 *
 *   factor = [360(Y2−Y1) + 30(M2−M1) + (D2−D1)] / 360
 *
 * Note: this is the Bond Basis variant. The fuller US (NASD) variant with the
 * February end-of-month rules is `calculate_30_360_US_NASD`.
 */
function calculate_30_360_US(startDate: UTCDate, endDate: UTCDate): number {
  let d1 = startDate.day;
  const m1 = startDate.month + 1; // UTCDate.month is 0-indexed, convert to 1-indexed
  const y1 = startDate.year;

  let d2 = endDate.day;
  const m2 = endDate.month + 1;
  const y2 = endDate.year;

  // Adjustment rules for 30/360 Bond Basis
  if (d1 === 31) {
    d1 = 30;
  }
  if (d2 === 31 && d1 >= 30) {
    d2 = 30;
  }

  const days = 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
  return days / 360;
}

/**
 * 30/360 US (NASD / SIA)  - the full US variant including February rules.
 * End-of-month (EOM) handling is assumed ON, applied in this exact order:
 *   1. if D1 is last day of Feb AND D2 is last day of Feb: D2 = 30
 *   2. if D1 is last day of Feb:                            D1 = 30
 *   3. if D2 = 31 and D1 in {30, 31}:                       D2 = 30
 *   4. if D1 = 31:                                          D1 = 30
 *
 *   factor = [360(Y2−Y1) + 30(M2−M1) + (D2−D1)] / 360
 *
 * Differs from Bond Basis only for periods touching the end of February
 * (e.g. 2007-02-28 → 2007-03-31 gives 30/360 here vs 33/360 under Bond Basis).
 */
function calculate_30_360_US_NASD(startDate: UTCDate, endDate: UTCDate): number {
  let d1 = startDate.day;
  const m1 = startDate.month + 1;
  const y1 = startDate.year;

  let d2 = endDate.day;
  const m2 = endDate.month + 1;
  const y2 = endDate.year;

  const startLastFeb = isLastDayOfFebruary(startDate);
  const endLastFeb = isLastDayOfFebruary(endDate);

  if (startLastFeb && endLastFeb) {
    d2 = 30;
  }
  if (startLastFeb) {
    d1 = 30;
  }
  if (d2 === 31 && d1 >= 30) {
    d2 = 30;
  }
  if (d1 === 31) {
    d1 = 30;
  }

  const days = 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
  return days / 360;
}

/**
 * 30E/360 (Eurobond basis, 30/360 ICMA)  - exposed in the UI as "30/360 EU"
 * Assumes 30-day months and a 360-day year, with symmetric rules:
 *   if D1 = 31: D1 = 30
 *   if D2 = 31: D2 = 30
 *
 *   factor = [360(Y2−Y1) + 30(M2−M1) + (D2−D1)] / 360
 *
 * Used for eurobonds.
 */
function calculate_30_360_EU(startDate: UTCDate, endDate: UTCDate): number {
  let d1 = startDate.day;
  const m1 = startDate.month + 1;
  const y1 = startDate.year;

  let d2 = endDate.day;
  const m2 = endDate.month + 1;
  const y2 = endDate.year;

  // European adjustment: if day is 31, change to 30
  if (d1 === 31) {
    d1 = 30;
  }
  if (d2 === 31) {
    d2 = 30;
  }

  const days = 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
  return days / 360;
}

/**
 * 30/366 (NON-STANDARD)
 * 30/360-style numerator (using the symmetric 30E/360 day rules) divided by a
 * fixed 366-day year. Not a recognised market convention - included as a
 * leap-length analogue to 30/360, parallel to the non-standard Actual/366.
 */
function calculate_30_366(startDate: UTCDate, endDate: UTCDate): number {
  let d1 = startDate.day;
  const m1 = startDate.month + 1;
  const y1 = startDate.year;

  let d2 = endDate.day;
  const m2 = endDate.month + 1;
  const y2 = endDate.year;

  if (d1 === 31) {
    d1 = 30;
  }
  if (d2 === 31) {
    d2 = 30;
  }

  // 30-day-month numerator over a fixed 366-day year.
  const days = 360 * (y2 - y1) + 30 * (m2 - m1) + (d2 - d1);
  return days / 366;
}

/**
 * 1/1
 * Always returns a factor of 1.0 for the period - used where a single fixed
 * payment is made per period regardless of the actual elapsed time.
 */
function calculate_1_1(_startDate: UTCDate, _endDate: UTCDate): number {
  return 1;
}

/**
 * @category Calendars & Day-Count
 */
export type DayCountConvention =
  | "ACT_365" // Actual/365 Fixed
  | "ACT_366" // Actual/366 (non-standard)
  | "ACT_364" // Actual/364
  | "ACT_360" // Actual/360
  | "ACT_ACT" // Actual/Actual (ISDA)
  | "ACT_ACT_AFB" // Actual/Actual (AFB)
  | "NL_365" // NL/365 (No Leap)
  | "30_360_US" // 30/360 Bond Basis
  | "30_360_NASD" // 30/360 US (NASD, with February rules)
  | "30_360_EU" // 30E/360 (Eurobond)
  | "30_366" // 30/366 (non-standard)
  | "1_1"; // 1/1

// NOTE: three conventions on the day-count-convention reference are intentionally
// NOT implemented here because they require more than a (start, end) pair:
//   - Actual/Actual ICMA  → needs the coupon frequency and reference period end
//   - Actual/365L         → needs the coupon frequency to pick 365 vs 366
//   - 30E/360 ISDA        → needs to know whether the end date is the maturity
// Add them once dayCountFraction is given the coupon context it would require.

// Returns the time fraction between two dates according to the specified convention
/**
 * @category Calendars & Day-Count
 */
export function dayCountFraction(
  startDate: UTCDate,
  endDate: UTCDate,
  convention: DayCountConvention,
): number {
  switch (convention) {
    case "ACT_360":
      return calculate_ACT_360(startDate, endDate);

    case "ACT_365":
      return calculate_ACT_365(startDate, endDate);

    case "ACT_364":
      return calculate_ACT_364(startDate, endDate);

    case "ACT_366":
      return calculate_ACT_366(startDate, endDate);

    case "NL_365":
      return calculate_NL_365(startDate, endDate);

    case "ACT_ACT":
      return calculate_ACT_ACT(startDate, endDate);

    case "ACT_ACT_AFB":
      return calculate_ACT_ACT_AFB(startDate, endDate);

    case "30_360_US":
      return calculate_30_360_US(startDate, endDate);

    case "30_360_NASD":
      return calculate_30_360_US_NASD(startDate, endDate);

    case "30_360_EU":
      return calculate_30_360_EU(startDate, endDate);

    case "30_366":
      return calculate_30_366(startDate, endDate);

    case "1_1":
      return calculate_1_1(startDate, endDate);

    default:
      throw new Error(`Unsupported day count convention: ${convention}`);
  }
}

/**
 * Returns the integer number of days a convention actually *counts* between two
 * dates - i.e. the numerator of the day-count fraction. This is distinct from
 * the raw calendar-day gap (`UTCDate.daysUntil`):
 *
 *   - ACT/* (and Act/Act ISDA & AFB): counts the true elapsed calendar days, so
 *     this equals the calendar gap (those conventions adjust only the
 *     denominator, never the day count).
 *   - NL/365: the calendar gap minus any 29 February (leap days are dropped).
 *   - 30/360 family: the 30-day-month adjusted count (e.g. 1→31 of a month is
 *     29 days under 30E/360, not the 30 calendar days), recovered as
 *     fraction × year-basis.
 *
 * Useful for surfacing *why* a 30/360 fraction differs from the calendar gap.
 */
/**
 * @category Calendars & Day-Count
 */
export function dayCountDays(
  startDate: UTCDate,
  endDate: UTCDate,
  convention: DayCountConvention,
): number {
  switch (convention) {
    // Actual-day conventions count the real elapsed days (only the denominator
    // varies between them).
    case "ACT_360":
    case "ACT_365":
    case "ACT_364":
    case "ACT_366":
    case "ACT_ACT":
    case "ACT_ACT_AFB":
    case "1_1":
      return actualDays(startDate, endDate);

    // No-leap basis: drop any 29 February from the elapsed days.
    case "NL_365":
      return actualDays(startDate, endDate) - countLeapDays(startDate, endDate);

    // 30/360 family: recover the adjusted numerator from the fraction. The
    // fraction is exactly k/basis for an integer k, so this rounds cleanly.
    case "30_360_US":
    case "30_360_NASD":
    case "30_360_EU":
      return Math.round(dayCountFraction(startDate, endDate, convention) * 360);
    case "30_366":
      return Math.round(dayCountFraction(startDate, endDate, convention) * 366);

    default:
      throw new Error(`Unsupported day count convention: ${convention}`);
  }
}
