import { Currency, Percentage } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

/**
 * An immutable monetary amount bound to a single {@link Currency}.
 *
 * Money replaces a bare `number` so that an amount can never be silently
 * confused with another denomination: every binary operation
 * ({@link add}, {@link subtract}, {@link equals}, …) refuses to combine values
 * in different currencies and reports a {@link Result} failure instead of
 * producing a meaningless figure. Crossing currencies is only possible
 * deliberately, via {@link convertTo} with an explicit FX rate.
 *
 * Instances are validated on construction (the amount must be finite) and never
 * mutate - arithmetic returns a fresh `Money` wrapped in a {@link Result}.
 *
 * @example
 * ```ts
 * const usd = Currency.create("USD").value;
 * const a = Money.create(100, usd).value;
 * const b = Money.create(25, usd).value;
 * const total = a.add(b); // Result<Money> holding $125.00
 * ```
 *
 * @category Value Objects
 */
export class Money {
  /**
   * @param _amount - The numeric amount, in major units of `_currency`.
   * @param _currency - The {@link Currency} this amount is denominated in.
   * @remarks Prefer the validating factories ({@link create}, {@link zero})
   *   over the constructor; they guard against non-finite amounts.
   */
  constructor(
    private readonly _amount: number,
    private readonly _currency: Currency
  ) {}

  /**
   * Creates a {@link Money} after validating the amount.
   *
   * @param amount - The monetary amount; must be finite (no `NaN`/`Infinity`).
   * @param currency - The {@link Currency} the amount is expressed in.
   * @returns A successful {@link Result} with the `Money`, or a failure when
   *   `amount` is not finite. This factory never throws.
   */
  static create(amount: number, currency: Currency): Result<Money> {
    if (!Number.isFinite(amount)) {
      return ResultHelper.failure("Amount must be a finite number");
    }
    return ResultHelper.success(new Money(amount, currency));
  }

  /**
   * Creates a zero amount in the given currency.
   *
   * @param currency - The {@link Currency} for the zero value.
   * @returns A {@link Result} holding `0` in `currency` (always successful).
   */
  static zero(currency: Currency): Result<Money> {
    return Money.create(0, currency);
  }

  /** The numeric amount in major units of {@link currency}. */
  get amount(): number {
    return this._amount;
  }

  /** The {@link Currency} this amount is denominated in. */
  get currency(): Currency {
    return this._currency;
  }

  /**
   * Converts this amount into another currency at an explicit rate.
   *
   * This is the only operation that deliberately crosses currencies. When the
   * target matches the current currency the amount is returned unchanged
   * (the rate is ignored); otherwise the amount is multiplied by `rate`.
   *
   * @param targetCurrency - The {@link Currency} to convert into.
   * @param rate - Units of `targetCurrency` per unit of this currency; must be
   *   finite and strictly positive.
   * @returns The converted {@link Money}, or a failure when `rate` is
   *   non-finite or non-positive.
   */
  convertTo(targetCurrency: Currency, rate: number): Result<Money> {
    // Validate rate
    if (!Number.isFinite(rate)) {
      return ResultHelper.failure(`Exchange rate ${rate} must be a finite number`);
    }
    
    if (rate <= 0) {
      return ResultHelper.failure(`Exchange rate ${rate} must be positive`);
    }

    // If same currency, return a copy with same amount
    if (this._currency.equals(targetCurrency)) {
      return Money.create(this._amount, targetCurrency);
    }

    // Perform conversion
    const convertedAmount = this._amount * rate;
    
    return Money.create(convertedAmount, targetCurrency);
  }

  /**
   * Adds another amount of the same currency.
   *
   * @param other - The {@link Money} to add; must share this currency.
   * @returns The sum, or a failure if the currencies differ.
   */
  add(other: Money): Result<Money> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return Money.create(this._amount + other._amount, this._currency);
  }

  /**
   * Subtracts another amount of the same currency.
   *
   * @param other - The {@link Money} to subtract; must share this currency.
   * @returns The difference, or a failure if the currencies differ.
   */
  subtract(other: Money): Result<Money> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return Money.create(this._amount - other._amount, this._currency);
  }

  /**
   * Scales the amount by a dimensionless factor (currency unchanged).
   *
   * @param factor - A finite multiplier.
   * @returns The scaled {@link Money}, or a failure if `factor` is not finite.
   */
  multiply(factor: number): Result<Money> {
    if (!Number.isFinite(factor)) {
      return ResultHelper.failure(`Factor ${factor} must be a finite number`);
    }
    return Money.create(this._amount * factor, this._currency);
  }

  /**
   * Divides the amount by a dimensionless divisor (currency unchanged).
   *
   * @param divisor - A finite, non-zero divisor.
   * @returns The quotient {@link Money}, or a failure if `divisor` is not
   *   finite or is zero.
   */
  divide(divisor: number): Result<Money> {
    if (!Number.isFinite(divisor)) {
      return ResultHelper.failure(`Divisor ${divisor} must be a finite number`);
    }
    if (divisor === 0) {
      return ResultHelper.failure("Cannot divide by zero");
    }
    return Money.create(this._amount / divisor, this._currency);
  }

  /**
   * Flips the sign of the amount (currency unchanged).
   *
   * @returns A {@link Money} with the negated amount.
   */
  negate(): Result<Money> {
    return Money.create(-this._amount, this._currency);
  }

  /**
   * Takes the absolute value of the amount (currency unchanged).
   *
   * @returns A non-negative {@link Money}.
   */
  abs(): Result<Money> {
    return Money.create(Math.abs(this._amount), this._currency);
  }

  /**
   * Multiplies the amount by a {@link Percentage} (e.g. applying a coupon rate).
   *
   * Uses the percentage's decimal form, so 5% scales the amount by `0.05`.
   *
   * @param percentage - The {@link Percentage} to apply.
   * @returns The scaled {@link Money}.
   */
  multiplyByPercentage(percentage: Percentage): Result<Money> {
    return Money.create(this._amount * percentage.asDecimal, this._currency);
  }

  /**
   * Divides the amount by a {@link Percentage} (using its decimal form).
   *
   * @param percentage - The {@link Percentage} divisor; its decimal value must
   *   be non-zero.
   * @returns The quotient {@link Money}, or a failure on a zero percentage.
   */
  divideByPercentage(percentage: Percentage): Result<Money> {
    if (percentage.asDecimal === 0) {
      return ResultHelper.failure("Cannot divide by zero percentage");
    }
    return Money.create(this._amount / percentage.asDecimal, this._currency);
  }

  /**
   * Discounts this amount back to present value.
   *
   * Treats this `Money` as a cash flow received `timeInYears` from now and
   * divides it by the compound discount factor `(1 + rate) ^ years`.
   *
   * @param discountRate - The per-period discount rate as a {@link Percentage}.
   * @param timeInYears - Time to the cash flow, in years; must be finite and
   *   non-negative.
   * @returns The present value {@link Money}, or a failure for invalid time or
   *   a degenerate (zero) discount factor.
   */
  presentValue(discountRate: Percentage, timeInYears: number): Result<Money> {
    if (!Number.isFinite(timeInYears)) {
      return ResultHelper.failure(`Time ${timeInYears} must be a finite number`);
    }
    if (timeInYears < 0) {
      return ResultHelper.failure(`Time ${timeInYears} cannot be negative`);
    }

    const discountFactor = Math.pow(1 + discountRate.asDecimal, timeInYears);
    if (discountFactor === 0) {
      return ResultHelper.failure(`Discount factor resulted in zero with these inputs: Discount Rate: ${discountRate.asDecimal}, Years: ${timeInYears}, formula 1+disc^years`);
    }

    return Money.create(this._amount / discountFactor, this._currency);
  }

  /**
   * Compounds this amount forward to future value.
   *
   * Grows the amount by `(1 + rate) ^ years`, the inverse of
   * {@link presentValue}.
   *
   * @param growthRate - The per-period growth rate as a {@link Percentage}.
   * @param timeInYears - Horizon in years; must be finite and non-negative.
   * @returns The future value {@link Money}, or a failure for invalid time.
   */
  futureValue(growthRate: Percentage, timeInYears: number): Result<Money> {
    if (!Number.isFinite(timeInYears)) {
      return ResultHelper.failure(`Time ${timeInYears} must be a finite number`);
    }
    if (timeInYears < 0) {
      return ResultHelper.failure(`Time ${timeInYears} cannot be negative`);
    }

    const growthFactor = Math.pow(1 + growthRate.asDecimal, timeInYears);
    return Money.create(this._amount * growthFactor, this._currency);
  }

  /**
   * Tests amount equality, requiring matching currencies.
   *
   * @param other - The {@link Money} to compare against.
   * @returns A {@link Result} holding the boolean, or a failure if the
   *   currencies differ (comparing across denominations is meaningless).
   */
  equals(other: Money): Result<boolean> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return ResultHelper.success(this._amount === other._amount);
  }

  /**
   * Tests whether this amount exceeds another of the same currency.
   *
   * @param other - The {@link Money} to compare against.
   * @returns A {@link Result} holding the boolean, or a failure if the
   *   currencies differ.
   */
  isGreaterThan(other: Money): Result<boolean> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return ResultHelper.success(this._amount > other._amount);
  }

  /**
   * Tests whether this amount is below another of the same currency.
   *
   * @param other - The {@link Money} to compare against.
   * @returns A {@link Result} holding the boolean, or a failure if the
   *   currencies differ.
   */
  isLessThan(other: Money): Result<boolean> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return ResultHelper.success(this._amount < other._amount);
  }

  /** Whether the amount is exactly zero. */
  isZero(): boolean {
    return this._amount === 0;
  }

  /** Whether the amount is strictly greater than zero. */
  isPositive(): boolean {
    return this._amount > 0;
  }

  /** Whether the amount is strictly less than zero. */
  isNegative(): boolean {
    return this._amount < 0;
  }

  /**
   * Formats the amount with its currency symbol and conventional decimals.
   *
   * @returns A display string such as `"$125.00"` or `"¥1200"` (JPY has zero
   *   decimals - see {@link Currency.decimals}).
   */
  toString(): string {
    const formattedAmount = this._amount.toFixed(this._currency.decimals);
    return `${this._currency.symbol}${formattedAmount}`;
  }

  /**
   * Formats just the numeric amount to the currency's decimal precision,
   * without the symbol.
   *
   * @returns A bare numeric string such as `"125.00"`.
   */
  toAmountString(): string {
    return this._amount.toFixed(this._currency.decimals);
  }
}