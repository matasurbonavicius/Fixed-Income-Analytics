import { Result, ResultHelper } from "@domain/shared";

export class UTCDate {
  private constructor(private readonly _value: Date) {}

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

  static today(): Result<UTCDate> {
    const utcDateResult = UTCDate.fromDate(new Date());

    if (!utcDateResult.success) {
      return ResultHelper.failure("Today's date creation unsuccessful");
    }

    return utcDateResult;
  }

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

  get year(): number {
    return this._value.getUTCFullYear();
  }

  get month(): number {
    return this._value.getUTCMonth();
  }

  get day(): number {
    return this._value.getUTCDate();
  }

  get dayOfWeek(): number {
    return this._value.getUTCDay(); // 0 (Sun) - 6 (Sat)
  }

  // Defensive copy
  toDate(): Date {
    return new Date(this._value.getTime());
  }

  toISOString(): string {
    return this._value.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  equals(other: UTCDate): boolean {
    return this._value.getTime() === other._value.getTime();
  }

  isBefore(other: UTCDate): boolean {
    return this._value.getTime() < other._value.getTime();
  }

  isAfter(other: UTCDate): boolean {
    return this._value.getTime() > other._value.getTime();
  }

  isSameOrBefore(other: UTCDate): boolean {
    return this._value.getTime() <= other._value.getTime();
  }

  isSameOrAfter(other: UTCDate): boolean {
    return this._value.getTime() >= other._value.getTime();
  }

  addDays(days: number): Result<UTCDate> {
    if (!Number.isInteger(days)) {
      return ResultHelper.failure("Days must be an integer");
    }

    const d = new Date(this._value.getTime());
    d.setUTCDate(d.getUTCDate() + days);

    return ResultHelper.success(new UTCDate(d));
  }

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

  addYears(years: number): Result<UTCDate> {
    if (!Number.isInteger(years)) {
      return ResultHelper.failure("Years must be an integer");
    }

    const d = new Date(this._value.getTime());
    d.setUTCFullYear(d.getUTCFullYear() + years);

    return ResultHelper.success(new UTCDate(d));
  }

  isWeekend(): boolean {
    const dow = this.dayOfWeek;
    return dow === 0 || dow === 6;
  }


  daysUntil(other: UTCDate): number {
    const msPerDay = 86_400_000;
    return Math.round(
      (other._value.getTime() - this._value.getTime()) / msPerDay
    );
  }

  diffMonths(other: UTCDate): number {
    return (other.year - this.year) * 12 + (other.month - this.month);
  }

  isLeapYear(): boolean {
    const year = this.year;
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  daysInYear(): number {
    return this.isLeapYear() ? 366 : 365;
  }

  daysInMonth(): number {
    const month = this.month;

    // Month is 0-indexed: 0=Jan, 1=Feb, etc.
    const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (month === 1 && this.isLeapYear()) {
      return 29; // February in leap year
    }

    return daysPerMonth[month];
  }

  startOfMonth(): Result<UTCDate> {
    return UTCDate.fromComponents(this.year, this.month, 1);
  }

  endOfMonth(): Result<UTCDate> {
    return UTCDate.fromComponents(this.year, this.month, this.daysInMonth());
  }

  clone(): UTCDate {
    return new UTCDate(new Date(this._value.getTime()));
  }

  toString(): string {
    return this.toISOString();
  }
}
