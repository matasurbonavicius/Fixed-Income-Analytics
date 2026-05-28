import { Currency, Percentage } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

export class Money {
  constructor(
    private readonly _amount: number,
    private readonly _currency: Currency
  ) {}

  static create(amount: number, currency: Currency): Result<Money> {
    if (!Number.isFinite(amount)) {
      return ResultHelper.failure("Amount must be a finite number");
    }
    return ResultHelper.success(new Money(amount, currency));
  }

  static zero(currency: Currency): Result<Money> {
    return Money.create(0, currency);
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): Currency {
    return this._currency;
  }

  // Currency conversion
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

  add(other: Money): Result<Money> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return Money.create(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Result<Money> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return Money.create(this._amount - other._amount, this._currency);
  }

  multiply(factor: number): Result<Money> {
    if (!Number.isFinite(factor)) {
      return ResultHelper.failure(`Factor ${factor} must be a finite number`);
    }
    return Money.create(this._amount * factor, this._currency);
  }

  divide(divisor: number): Result<Money> {
    if (!Number.isFinite(divisor)) {
      return ResultHelper.failure(`Divisor ${divisor} must be a finite number`);
    }
    if (divisor === 0) {
      return ResultHelper.failure("Cannot divide by zero");
    }
    return Money.create(this._amount / divisor, this._currency);
  }

  negate(): Result<Money> {
    return Money.create(-this._amount, this._currency);
  }

  abs(): Result<Money> {
    return Money.create(Math.abs(this._amount), this._currency);
  }

  multiplyByPercentage(percentage: Percentage): Result<Money> {
    return Money.create(this._amount * percentage.asDecimal, this._currency);
  }

  divideByPercentage(percentage: Percentage): Result<Money> {
    if (percentage.asDecimal === 0) {
      return ResultHelper.failure("Cannot divide by zero percentage");
    }
    return Money.create(this._amount / percentage.asDecimal, this._currency);
  }

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

  equals(other: Money): Result<boolean> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return ResultHelper.success(this._amount === other._amount);
  }

  isGreaterThan(other: Money): Result<boolean> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return ResultHelper.success(this._amount > other._amount);
  }

  isLessThan(other: Money): Result<boolean> {
    if (!this._currency.equals(other._currency)) {
      return ResultHelper.failure(
        `Currency mismatch: ${this._currency.code} vs ${other._currency.code}`
      );
    }
    return ResultHelper.success(this._amount < other._amount);
  }

  isZero(): boolean {
    return this._amount === 0;
  }

  isPositive(): boolean {
    return this._amount > 0;
  }

  isNegative(): boolean {
    return this._amount < 0;
  }

  toString(): string {
    const formattedAmount = this._amount.toFixed(this._currency.decimals);
    return `${this._currency.symbol}${formattedAmount}`;
  }

  toAmountString(): string {
    return this._amount.toFixed(this._currency.decimals);
  }
}