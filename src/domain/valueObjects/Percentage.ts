import { Result, ResultHelper } from "@domain/shared";

export class Percentage {
  constructor(private readonly _value: number) {}

  static fromDecimal(decimal: number): Result<Percentage> {
    if (!Number.isFinite(decimal)) {
      return ResultHelper.failure("Decimal value must be a finite number");
    }
    return ResultHelper.success(new Percentage(decimal));
  }

  static fromPercent(percent: number): Result<Percentage> {
    if (!Number.isFinite(percent)) {
      return ResultHelper.failure("Percent value must be a finite number");
    }
    return ResultHelper.success(new Percentage(percent / 100));
  }

  static zero(): Result<Percentage> {
    return ResultHelper.success(new Percentage(0));
  }

  get asDecimal(): number {
    return this._value;
  }

  get asPercent(): number {
    return this._value * 100;
  }

  add(other: Percentage): Result<Percentage> {
    const newValue = this._value + other._value;
    return ResultHelper.success(new Percentage(newValue));
  }

  subtract(other: Percentage): Result<Percentage> {
    const newValue = this._value - other._value;
    return ResultHelper.success(new Percentage(newValue));
  }

  multiply(factor: number): Result<Percentage> {
    if (!Number.isFinite(factor)) {
      return ResultHelper.failure(`Factor ${factor} must be a finite number`);
    }
    const newValue = this._value * factor;
    return ResultHelper.success(new Percentage(newValue));
  }

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

  negate(): Result<Percentage> {
    return ResultHelper.success(new Percentage(-this._value));
  }

  abs(): Result<Percentage> {
    return ResultHelper.success(new Percentage(Math.abs(this._value)));
  }

  isZero(): boolean {
    return this._value === 0;
  }

  isPositive(): boolean {
    return this._value > 0;
  }

  isNegative(): boolean {
    return this._value < 0;
  }

  equals(other: Percentage): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return `${this.asPercent.toFixed(2)}%`;
  }
}