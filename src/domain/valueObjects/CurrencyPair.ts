import { Currency } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

// Represents a currency pair (e.g., EUR/USD)
// Base currency is what you're converting FROM
// Quote currency is what you're converting TO
export class CurrencyPair {
  constructor(
    private readonly _base: Currency,
    private readonly _quote: Currency
  ) {}

  static create(base: Currency, quote: Currency): Result<CurrencyPair> {
    if (base.equals(quote)) {
      return ResultHelper.failure(
        `Cannot create currency pair with same currency: ${base.code}`
      );
    }
    return ResultHelper.success(new CurrencyPair(base, quote));
  }

  get base(): Currency {
    return this._base;
  }

  get quote(): Currency {
    return this._quote;
  }

  get code(): string {
    return `${this._base.code}/${this._quote.code}`;
  }

  // Invert the pair (EUR/USD → USD/EUR)
  invert(): CurrencyPair {
    return new CurrencyPair(this._quote, this._base);
  }

  // Check if this pair equals another (exact match) -> EUR/USD = EUR/USD != USD/EUR
  equals(other: CurrencyPair): boolean {
    return this._base.equals(other._base) && this._quote.equals(other._quote);
  }

  // Check if this pair matches another (including inverted) -> EUR/USD = USD/EUR
  matchesInverted(other: CurrencyPair): boolean {
    return this.equals(other.invert());
  }

  toString(): string {
    return this.code;
  }
}
