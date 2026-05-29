import { BusinessDayConvention } from "@domain/entities";
import {
  CalendarCode,
  CalendarData,
  calendarDataJSON,
} from "@calendars";
import { UTCDate } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

const calendarData = calendarDataJSON as CalendarData;

function isWeekend(date: UTCDate, calendar: CalendarCode): boolean {
  const calendarInfo = calendarData.calendars[calendar];

  if (!calendarInfo) {
    throw new Error(`Unknown calendar: ${calendar}`);
  }

  const dayOfWeek = date.dayOfWeek;
  return calendarInfo.weekendDays.includes(dayOfWeek);
}

function isHoliday(date: UTCDate, calendar: CalendarCode): boolean {
  const calendarInfo = calendarData.calendars[calendar];

  if (!calendarInfo) {
    throw new Error(`Unknown calendar: ${calendar}`);
  }

  const year = date.year.toString();
  const holidays = calendarInfo.holidays[year];

  if (!holidays) {
    // Year not in calendar data - fall back to weekend-only check
    return false;
  }

  // Use UTCDate's ISO string representation (YYYY-MM-DD)
  const dateStr = date.toISOString();
  return holidays.includes(dateStr);
}

/**
 * Returns all configured market holidays (ISO YYYY-MM-DD strings) for a calendar
 * in a given year, sorted ascending. Weekends are NOT included - these are the
 * explicit holidays only. Returns an empty array when the calendar has no data
 * for that year (e.g. a year outside the loaded range).
 */
/**
 * @category Calendars & Day-Count
 */
export function getCalendarHolidays(
  calendar: CalendarCode,
  year: number
): string[] {
  const calendarInfo = calendarData.calendars[calendar];

  if (!calendarInfo) {
    throw new Error(`Unknown calendar: ${calendar}`);
  }

  const holidays = calendarInfo.holidays[year.toString()];
  if (!holidays) {
    return [];
  }

  // ISO date strings sort lexicographically in chronological order.
  return [...holidays].sort();
}

/**
 * @category Calendars & Day-Count
 */
export function isBusinessDay(
  date: UTCDate,
  calendar: CalendarCode
): boolean {
  return !isWeekend(date, calendar) && !isHoliday(date, calendar);
}

/**
 * Following Convention
 * If date falls on non-business day, move to next business day
 */
function applyFollowing(date: UTCDate, calendar: CalendarCode): Result<UTCDate> {
  let adjusted = date.clone();
  while (!isBusinessDay(adjusted, calendar)) {
    const nextDayResult = adjusted.addDays(1);
    if (!nextDayResult.success) {
      return nextDayResult;
    }
    adjusted = nextDayResult.value;
  }
  return ResultHelper.success(adjusted);
}

/**
 * Modified Following Convention
 * Same as Following, but if it crosses into next month, go backwards instead
 */
function applyModifiedFollowing(date: UTCDate, calendar: CalendarCode): Result<UTCDate> {
  const adjustedResult = applyFollowing(date, calendar);
  if (!adjustedResult.success) {
    return adjustedResult;
  }
  const adjusted = adjustedResult.value;

  // If we crossed into next month, use preceding instead
  if (adjusted.month !== date.month) {
    return applyPreceding(date, calendar);
  }

  return ResultHelper.success(adjusted);
}

/**
 * Preceding Convention
 * If date falls on non-business day, move to previous business day
 */
function applyPreceding(date: UTCDate, calendar: CalendarCode): Result<UTCDate> {
  let adjusted = date.clone();
  while (!isBusinessDay(adjusted, calendar)) {
    const prevDayResult = adjusted.addDays(-1);
    if (!prevDayResult.success) {
      return prevDayResult;
    }
    adjusted = prevDayResult.value;
  }
  return ResultHelper.success(adjusted);
}

/**
 * Modified Preceding Convention
 * Same as Preceding, but if it crosses into previous month, go forward instead
 */
function applyModifiedPreceding(date: UTCDate, calendar: CalendarCode): Result<UTCDate> {
  const adjustedResult = applyPreceding(date, calendar);
  if (!adjustedResult.success) {
    return adjustedResult;
  }
  const adjusted = adjustedResult.value;

  // If we crossed into previous month, use following instead
  if (adjusted.month !== date.month) {
    return applyFollowing(date, calendar);
  }

  return ResultHelper.success(adjusted);
}

/**
 * Main business day adjustment function
 * Adjusts a date according to the specified convention and calendar
 */
/**
 * @category Calendars & Day-Count
 */
export function adjustForBusinessDay(
  date: UTCDate,
  convention: BusinessDayConvention,
  calendar: CalendarCode
): Result<UTCDate> {
  // UNADJUSTED convention never adjusts the date
  if (convention === "UNADJUSTED") {
    return ResultHelper.success(date.clone());
  }

  // If already a business day, return clone for other conventions
  if (isBusinessDay(date, calendar)) {
    return ResultHelper.success(date.clone());
  }

  switch (convention) {
    case "FOLLOWING":
      return applyFollowing(date, calendar);

    case "MODIFIED_FOLLOWING":
      return applyModifiedFollowing(date, calendar);

    case "PRECEDING":
      return applyPreceding(date, calendar);

    case "MODIFIED_PRECEDING":
      return applyModifiedPreceding(date, calendar);

    default:
      return ResultHelper.failure(`Unsupported business day convention: ${convention}`);
  }
}

/**
 * Add business days to a date (skipping weekends/holidays)
 */
/**
 * @category Calendars & Day-Count
 */
export function addBusinessDays(
  date: UTCDate,
  days: number,
  calendar: CalendarCode = "WEEKEND_ONLY"
): Result<UTCDate> {
  if (!Number.isInteger(days)) {
    return ResultHelper.failure("Days must be an integer");
  }

  let result = date.clone();
  let remainingDays = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;

  while (remainingDays > 0) {
    const nextDayResult = result.addDays(direction);
    if (!nextDayResult.success) {
      return nextDayResult;
    }
    result = nextDayResult.value;

    if (isBusinessDay(result, calendar)) {
      remainingDays--;
    }
  }

  return ResultHelper.success(result);
}

/**
 * Count business days between two dates (inclusive of start, exclusive of end)
 */
/**
 * @category Calendars & Day-Count
 */
export function countBusinessDays(
  startDate: UTCDate,
  endDate: UTCDate,
  calendar: CalendarCode = "WEEKEND_ONLY"
): number {
  let count = 0;
  let current = startDate.clone();

  while (current.isBefore(endDate)) {
    if (isBusinessDay(current, calendar)) {
      count++;
    }
    const nextDayResult = current.addDays(1);
    if (!nextDayResult.success) {
      throw new Error(`Failed to add day: ${nextDayResult.error}`);
    }
    current = nextDayResult.value;
  }

  return count;
}

/**
 * Get the next business day from the given date
 */
/**
 * @category Calendars & Day-Count
 */
export function getNextBusinessDay(
  date: UTCDate,
  calendar: CalendarCode = "WEEKEND_ONLY"
): Result<UTCDate> {
  return addBusinessDays(date, 1, calendar);
}

/**
 * Get the previous business day from the given date
 */
/**
 * @category Calendars & Day-Count
 */
export function getPreviousBusinessDay(
  date: UTCDate,
  calendar: CalendarCode = "WEEKEND_ONLY"
): Result<UTCDate> {
  return addBusinessDays(date, -1, calendar);
}

/**
 * Check if calendar data is available for a given year
 */
/**
 * @category Calendars & Day-Count
 */
export function isYearSupported(year: number, calendar: CalendarCode): boolean {
  try {
    return year.toString() in calendarData.calendars[calendar].holidays;
  } catch {
    return false;
  }
}

/**
 * Get all holidays for a given year and calendar
 */
/**
 * @category Calendars & Day-Count
 */
export function getHolidaysForYear(
  year: number,
  calendar: CalendarCode
): Result<UTCDate[]> {
  const calendarInfo = calendarData.calendars[calendar];

  if (!calendarInfo) {
    return ResultHelper.failure(`Unknown calendar: ${calendar}`);
  }

  const holidays = calendarInfo.holidays[year.toString()];

  if (!holidays) {
    return ResultHelper.success([]);
  }

  const utcDates: UTCDate[] = [];
  for (const dateStr of holidays) {
    const dateResult = UTCDate.fromString(dateStr);
    if (!dateResult.success) {
      return ResultHelper.failure(`Invalid holiday date: ${dateStr}`);
    }
    utcDates.push(dateResult.value);
  }

  return ResultHelper.success(utcDates);
}

/**
 * Get calendar metadata
 */
/**
 * @category Calendars & Day-Count
 */
export function getCalendarMetadata() {
  return {
    version: calendarData.version,
    generated: calendarData.generated,
    startYear: calendarData.metadata.startYear,
    endYear: calendarData.metadata.endYear,
    availableCalendars: Object.keys(calendarData.calendars) as CalendarCode[],
  };
}
