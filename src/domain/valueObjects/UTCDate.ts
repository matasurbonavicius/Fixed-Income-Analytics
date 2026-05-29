import { Result, ResultHelper } from "@domain/shared";

/**
 * A calendar date anchored to UTC midnight, safe for day-count arithmetic.
 *
 * The native `Date` is a timestamp in local time, which makes it treacherous
 * for fixed-income math: a "date" that is really `2025-03-09T23:00` in one zone
 * can roll across a day boundary or a DST transition and silently miscount the
 * days between a settlement and a coupon. `UTCDate` strips every value down to
 * UTC midnight (`YYYY-MM-DD` at `00:00:00Z`), so accrued-interest and
 * day-count fractions stay exact and zone-independent.
 *
 * Instances are immutable: arithmetic such as {@link addDays} / {@link addMonths}
 * returns a new `UTCDate`. The constructor is private - build instances through
 * the validating factories {@link fromString}, {@link fromDate},
 * {@link fromComponents}, or {@link today}, each of which returns a
 * {@link Result} and never throws on bad input.
 *
 * @example
 * ```ts
 * const settle = UTCDate.fromString("2025-01-31").value;
 * const next = settle.addMonths(1); // Result<UTCDate> → 2025-02-28 (clamped)
 * const days = settle.daysUntil(next.value); // 28
 * ```
 *
 * @category Value Objects
 */
export class UTCDate {
  private constructor(private readonly _value: Date) {}

  /**
   * Normalizes an arbitrary {@link Date} to its UTC calendar day.
   *
   * The time-of-day is discarded; only the UTC year/month/day are kept.
   *
   * @param date - A valid `Date`; invalid dates (`NaN` time) are rejected.
   * @returns The {@link UTCDate}, or a failure for an invalid input. Never
   *   throws.
   */
  static fromDate(date: Date): Result<UTCDate> {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return ResultHelper.failure("Invalid Date");
    }

    return ResultHelper.success(
      new UTCDate(
        new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
        )
      )
    );
  }

  /**
   * The current UTC calendar day.
   *
   * @returns A {@link Result} holding today's date (time-of-day stripped).
   *   Never throws.
   */
  static today(): Result<UTCDate> {
    const utcDateResult = UTCDate.fromDate(new Date());

    if (!utcDateResult.success) {
      return ResultHelper.failure("Today's date creation unsuccessful");
    }

    return utcDateResult;
  }

  /**
   * Parses a strict `YYYY-MM-DD` ISO date string.
   *
   * Only the date-only ISO form is accepted; anything else (wrong shape, a
   * full timestamp, a calendar-invalid date) is rejected rather than coerced.
   *
   * @param isoString - The date string in `YYYY-MM-DD` format.
   * @returns The {@link UTCDate}, or a failure describing the bad input. Never
   *   throws.
   */
  static fromString(isoString: string): Result<UTCDate> {
    if (typeof isoString !== "string") {
      return ResultHelper.failure("Input must be a string");
    }

    // Accept YYYY-MM-DD format
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoRegex.test(isoString)) {
      return ResultHelper.failure(
        `Invalid ISO date string format: ${isoString} (expected YYYY-MM-DD)`
      );
    }

    const parsed = new Date(isoString + "T00:00:00Z");
    if (Number.isNaN(parsed.getTime())) {
      return ResultHelper.failure(`Invalid date: ${isoString}`);
    }

    return ResultHelper.success(new UTCDate(parsed));
  }

  /**
   * Builds a date from individual numeric components.
   *
   * The constructed date is round-tripped to reject calendar-invalid inputs
   * such as February 30 (which the native `Date` would otherwise roll over).
   *
   * @param year - Full year (e.g. `2025`).
   * @param month - Month index, **0-based** (`0` = January, `11` = December),
   *   matching `Date.getUTCMonth`.
   * @param day - Day of month, `1`-`31`.
   * @returns The {@link UTCDate}, or a failure for non-integer or out-of-range
   *   or calendar-invalid values. Never throws.
   */
  static fromComponents(
    year: number,
    month: number,
    day: number
  ): Result<UTCDate> {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return ResultHelper.failure("Year, month, and day must be integers");
    }

    if (month < 0 || month > 11) {
      return ResultHelper.failure(`Month must be 0-11, got ${month}`);
    }

    if (day < 1 || day > 31) {
      return ResultHelper.failure(`Day must be 1-31, got ${day}`);
    }

    const date = new Date(Date.UTC(year, month, day));

    // Validate the date was created correctly (catches invalid dates like Feb 30)
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month ||
      date.getUTCDate() !== day
    ) {
      return ResultHelper.failure(
        `Invalid date: ${year}-${month + 1}-${day}`
      );
    }

    return ResultHelper.success(new UTCDate(date));
  }

  /** The full UTC year (e.g. `2025`). */
  get year(): number {
    return this._value.getUTCFullYear();
  }

  /** The 0-based UTC month (`0` = January, `11` = December). */
  get month(): number {
    return this._value.getUTCMonth();
  }

  /** The UTC day of the month, `1`-`31`. */
  get day(): number {
    return this._value.getUTCDate();
  }

  /** The UTC day of week, `0` (Sunday) through `6` (Saturday). */
  get dayOfWeek(): number {
    return this._value.getUTCDay(); // 0 (Sun) - 6 (Sat)
  }

  /**
   * Returns the underlying calendar day as a fresh native {@link Date}.
   *
   * A defensive copy is returned so callers cannot mutate the internal value
   * and break immutability.
   *
   * @returns A new `Date` at UTC midnight of this calendar day.
   */
  toDate(): Date {
    return new Date(this._value.getTime());
  }

  /**
   * Renders the date as a `YYYY-MM-DD` string.
   *
   * @returns The ISO date-only representation.
   */
  toISOString(): string {
    return this._value.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  /**
   * Tests whether two dates fall on the same UTC calendar day.
   *
   * @param other - The {@link UTCDate} to compare against.
   * @returns `true` when the days are identical.
   */
  equals(other: UTCDate): boolean {
    return this._value.getTime() === other._value.getTime();
  }

  /**
   * Whether this date is strictly earlier than `other`.
   *
   * @param other - The {@link UTCDate} to compare against.
   */
  isBefore(other: UTCDate): boolean {
    return this._value.getTime() < other._value.getTime();
  }

  /**
   * Whether this date is strictly later than `other`.
   *
   * @param other - The {@link UTCDate} to compare against.
   */
  isAfter(other: UTCDate): boolean {
    return this._value.getTime() > other._value.getTime();
  }

  /**
   * Whether this date is the same as or earlier than `other`.
   *
   * @param other - The {@link UTCDate} to compare against.
   */
  isSameOrBefore(other: UTCDate): boolean {
    return this._value.getTime() <= other._value.getTime();
  }

  /**
   * Whether this date is the same as or later than `other`.
   *
   * @param other - The {@link UTCDate} to compare against.
   */
  isSameOrAfter(other: UTCDate): boolean {
    return this._value.getTime() >= other._value.getTime();
  }

  /**
   * Returns a new date offset by a whole number of days.
   *
   * @param days - Days to add; may be negative. Must be an integer.
   * @returns The shifted {@link UTCDate}, or a failure for a non-integer input.
   */
  addDays(days: number): Result<UTCDate> {
    if (!Number.isInteger(days)) {
      return ResultHelper.failure("Days must be an integer");
    }

    const d = new Date(this._value.getTime());
    d.setUTCDate(d.getUTCDate() + days);

    return ResultHelper.success(new UTCDate(d));
  }

  /**
   * Returns a new date offset by a whole number of months.
   *
   * Guards against month-end overflow: adding a month to Jan 31 yields Feb 28
   * (or 29), not an accidental roll into March, which matters for coupon-date
   * schedules.
   *
   * @param months - Months to add; may be negative. Must be an integer.
   * @returns The shifted {@link UTCDate}, or a failure for a non-integer input.
   */
  addMonths(months: number): Result<UTCDate> {
    if (!Number.isInteger(months)) {
      return ResultHelper.failure("Months must be an integer");
    }

    const d = new Date(this._value.getTime());
    const originalDay = d.getUTCDate();

    d.setUTCMonth(d.getUTCMonth() + months);

    // Month-end rollover protection
    if (d.getUTCDate() !== originalDay) {
      d.setUTCDate(0);
    }

    return ResultHelper.success(new UTCDate(d));
  }

  /**
   * Returns a new date offset by a whole number of years.
   *
   * @param years - Years to add; may be negative. Must be an integer.
   * @returns The shifted {@link UTCDate}, or a failure for a non-integer input.
   */
  addYears(years: number): Result<UTCDate> {
    if (!Number.isInteger(years)) {
      return ResultHelper.failure("Years must be an integer");
    }

    const d = new Date(this._value.getTime());
    d.setUTCFullYear(d.getUTCFullYear() + years);

    return ResultHelper.success(new UTCDate(d));
  }

  /** Whether the date falls on a Saturday or Sunday. */
  isWeekend(): boolean {
    const dow = this.dayOfWeek;
    return dow === 0 || dow === 6;
  }


  /**
   * Counts whole calendar days from this date to `other`.
   *
   * @param other - The later (or earlier) {@link UTCDate}.
   * @returns The signed day count - positive when `other` is after this date,
   *   negative when before.
   */
  daysUntil(other: UTCDate): number {
    const msPerDay = 86_400_000;
    return Math.round(
      (other._value.getTime() - this._value.getTime()) / msPerDay
    );
  }

  /**
   * Counts whole calendar months from this date to `other`.
   *
   * Compares only year and month (day-of-month is ignored), so the result is a
   * signed month span.
   *
   * @param other - The {@link UTCDate} to measure to.
   * @returns The signed month count.
   */
  diffMonths(other: UTCDate): number {
    return (other.year - this.year) * 12 + (other.month - this.month);
  }

  /** Whether this date's year is a leap year (Gregorian rule). */
  isLeapYear(): boolean {
    const year = this.year;
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  /**
   * The number of days in this date's year (`365`, or `366` in a leap year).
   *
   * @returns The day count, useful for Actual/365-style day-count fractions.
   */
  daysInYear(): number {
    return this.isLeapYear() ? 366 : 365;
  }

  /**
   * The number of days in this date's month, accounting for leap-year February.
   *
   * @returns The day count (`28`-`31`).
   */
  daysInMonth(): number {
    const month = this.month;

    // Month is 0-indexed: 0=Jan, 1=Feb, etc.
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (month === 1 && this.isLeapYear()) {
      return 29; // February in leap year
    }

    return daysPerMonth[month];
  }

  /**
   * The first day of this date's month.
   *
   * @returns A {@link Result} holding the month's first day.
   */
  startOfMonth(): Result<UTCDate> {
    return UTCDate.fromComponents(this.year, this.month, 1);
  }

  /**
   * The last day of this date's month (leap-year aware).
   *
   * @returns A {@link Result} holding the month's final day.
   */
  endOfMonth(): Result<UTCDate> {
    return UTCDate.fromComponents(this.year, this.month, this.daysInMonth());
  }

  /**
   * Returns an independent copy of this date.
   *
   * @returns A new {@link UTCDate} for the same calendar day. (Largely a
   *   convenience, as instances are already immutable.)
   */
  clone(): UTCDate {
    return new UTCDate(new Date(this._value.getTime()));
  }

  /**
   * Renders the date as a `YYYY-MM-DD` string (same as {@link toISOString}).
   *
   * @returns The ISO date-only representation.
   */
  toString(): string {
    return this.toISOString();
  }
}
