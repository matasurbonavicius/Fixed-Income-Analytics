import { Result, ResultHelper } from "@domain/shared";

/**
 * An immutable rate, stored once and read in whichever unit you need.
 *
 * Rates are the perennial source of the "did you mean 5 or 0.05?" bug: a plain
 * `number` carrying `5` might mean five percent or five hundred percent
 * depending on who wrote the call site. `Percentage` settles the question by
 * holding the value as a **decimal fraction** internally and exposing two
 * explicit accessors - {@link asDecimal} (`0.05`) and {@link asPercent} (`5`) -
 * so the `×100` ambiguity is resolved at the type boundary rather than guessed.
 *
 * Construct via the named factories so the unit is unmistakable:
 * {@link fromDecimal} for `0.05`, {@link fromPercent} for `5`. Values are
 * validated (finite) and immutable; arithmetic returns a fresh `Percentage`.
 *
 * @example
 * ```ts
 * const r = Percentage.fromPercent(5).value;
 * r.asDecimal; // 0.05
 * r.asPercent; // 5
 * ```
 *
 * @category Value Objects
 */
export class Percentage {
  /**
   * @param _value - The rate as a decimal fraction (e.g. `0.05` for 5%).
   * @remarks Prefer {@link fromDecimal} / {@link fromPercent}, which make the
   *   intended unit explicit and validate finiteness.
   */
  constructor(private readonly _value: number) {}

  /**
   * Builds a {@link Percentage} from a decimal fraction.
   *
   * @param decimal - The rate as a fraction, e.g. `0.05` for 5%; must be finite.
   * @returns The {@link Percentage}, or a failure if `decimal` is not finite.
   *   Never throws.
   */
  static fromDecimal(decimal: number): Result<Percentage> {
    if (!Number.isFinite(decimal)) {
      return ResultHelper.failure("Decimal value must be a finite number");
    }
    return ResultHelper.success(new Percentage(decimal));
  }

  /**
   * Builds a {@link Percentage} from a whole-percent figure.
   *
   * @param percent - The rate in percent, e.g. `5` for 5% (stored as `0.05`);
   *   must be finite.
   * @returns The {@link Percentage}, or a failure if `percent` is not finite.
   *   Never throws.
   */
  static fromPercent(percent: number): Result<Percentage> {
    if (!Number.isFinite(percent)) {
      return ResultHelper.failure("Percent value must be a finite number");
    }
    return ResultHelper.success(new Percentage(percent / 100));
  }

  /**
   * A zero rate.
   *
   * @returns A {@link Percentage} of `0` (always successful).
   */
  static zero(): Result<Percentage> {
    return ResultHelper.success(new Percentage(0));
  }

  /** The rate as a decimal fraction (5% → `0.05`); use this in formulas. */
  get asDecimal(): number {
    return this._value;
  }

  /** The rate in percent (0.05 → `5`); use this for display. */
  get asPercent(): number {
    return this._value * 100;
  }

  /**
   * Adds two rates (in decimal space).
   *
   * @param other - The {@link Percentage} to add.
   * @returns The summed {@link Percentage}.
   */
  add(other: Percentage): Result<Percentage> {
    const newValue = this._value + other._value;
    return ResultHelper.success(new Percentage(newValue));
  }

  /**
   * Subtracts one rate from another (e.g. computing a spread).
   *
   * @param other - The {@link Percentage} to subtract.
   * @returns The resulting {@link Percentage}.
   */
  subtract(other: Percentage): Result<Percentage> {
    const newValue = this._value - other._value;
    return ResultHelper.success(new Percentage(newValue));
  }

  /**
   * Scales the rate by a dimensionless factor.
   *
   * @param factor - A finite multiplier.
   * @returns The scaled {@link Percentage}, or a failure if `factor` is not
   *   finite.
   */
  multiply(factor: number): Result<Percentage> {
    if (!Number.isFinite(factor)) {
      return ResultHelper.failure(`Factor ${factor} must be a finite number`);
    }
    const newValue = this._value * factor;
    return ResultHelper.success(new Percentage(newValue));
  }

  /**
   * Divides the rate by a dimensionless divisor.
   *
   * @param divisor - A finite, non-zero divisor.
   * @returns The resulting {@link Percentage}, or a failure if `divisor` is
   *   not finite or is zero.
   */
  divide(divisor: number): Result<Percentage> {
    if (!Number.isFinite(divisor)) {
      return ResultHelper.failure(`Divisor ${divisor} must be a finite number`);
    }
    if (divisor === 0) {
      return ResultHelper.failure("Cannot divide by zero");
    }
    const newValue = this._value / divisor;
    return ResultHelper.success(new Percentage(newValue));
  }

  /**
   * Flips the sign of the rate.
   *
   * @returns The negated {@link Percentage}.
   */
  negate(): Result<Percentage> {
    return ResultHelper.success(new Percentage(-this._value));
  }

  /**
   * Takes the absolute value of the rate.
   *
   * @returns A non-negative {@link Percentage}.
   */
  abs(): Result<Percentage> {
    return ResultHelper.success(new Percentage(Math.abs(this._value)));
  }

  /** Whether the rate is exactly zero. */
  isZero(): boolean {
    return this._value === 0;
  }

  /** Whether the rate is strictly positive. */
  isPositive(): boolean {
    return this._value > 0;
  }

  /** Whether the rate is strictly negative. */
  isNegative(): boolean {
    return this._value < 0;
  }

  /**
   * Tests exact equality against another rate.
   *
   * @param other - The {@link Percentage} to compare against.
   * @returns `true` when both hold the same decimal value.
   */
  equals(other: Percentage): boolean {
    return this._value === other._value;
  }

  /**
   * Formats the rate in percent with two decimals.
   *
   * @returns A display string such as `"5.00%"`.
   */
  toString(): string {
    return `${this.asPercent.toFixed(2)}%`;
  }
}