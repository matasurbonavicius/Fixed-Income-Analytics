import { Currency } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

// Represents a currency pair (e.g., EUR/USD)
// Base currency is what you're converting FROM
// Quote currency is what you're converting TO
/**
 * An immutable, ordered pair of currencies describing an FX conversion.
 *
 * Order is meaningful: the {@link base} is the currency you convert *from* and
 * the {@link quote} is the currency you convert *to* (the conventional
 * `BASE/QUOTE` reading, e.g. `EUR/USD` is "USD per EUR"). Modelling the pair as
 * a value object - rather than two loose {@link Currency} arguments - keeps the
 * direction explicit and lets a rate look-up distinguish a pair from its
 * {@link invert | inverse}.
 *
 * @example
 * ```ts
 * const eur = Currency.create("EUR").value;
 * const usd = Currency.create("USD").value;
 * const pair = CurrencyPair.create(eur, usd).value; // EUR/USD
 * pair.invert().code; // "USD/EUR"
 * ```
 *
 * @category Value Objects
 */
export class CurrencyPair {
  constructor(
    private readonly _base: Currency,
    private readonly _quote: Currency
  ) {}

  /**
   * Creates a pair from a base and quote {@link Currency}.
   *
   * The two currencies must differ - a pair of identical currencies has no
   * meaningful exchange rate and is rejected.
   *
   * @param base - The currency being converted *from*.
   * @param quote - The currency being converted *to*.
   * @returns The {@link CurrencyPair}, or a failure if both sides are the same
   *   currency. Never throws.
   */
  static create(base: Currency, quote: Currency): Result<CurrencyPair> {
    if (base.equals(quote)) {
      return ResultHelper.failure(
        `Cannot create currency pair with same currency: ${base.code}`
      );
    }
    return ResultHelper.success(new CurrencyPair(base, quote));
  }

  /** The base {@link Currency} - the one being converted *from*. */
  get base(): Currency {
    return this._base;
  }

  /** The quote {@link Currency} - the one being converted *to*. */
  get quote(): Currency {
    return this._quote;
  }

  /** The pair's canonical `BASE/QUOTE` code, e.g. `"EUR/USD"`. */
  get code(): string {
    return `${this._base.code}/${this._quote.code}`;
  }

  /**
   * Returns the reversed pair (`EUR/USD` → `USD/EUR`).
   *
   * @returns A new {@link CurrencyPair} with base and quote swapped.
   */
  invert(): CurrencyPair {
    return new CurrencyPair(this._quote, this._base);
  }

  /**
   * Tests exact, direction-sensitive equality.
   *
   * `EUR/USD` equals `EUR/USD` but **not** `USD/EUR`; for direction-agnostic
   * matching use {@link matchesInverted}.
   *
   * @param other - The {@link CurrencyPair} to compare against.
   * @returns `true` when base and quote both match in the same order.
   */
  equals(other: CurrencyPair): boolean {
    return this._base.equals(other._base) && this._quote.equals(other._quote);
  }

  /**
   * Tests whether `other` is this pair reversed.
   *
   * Useful when a quoted rate is available in the opposite direction and must
   * be inverted before use - e.g. `EUR/USD` matches an `USD/EUR` quote.
   *
   * @param other - The {@link CurrencyPair} to compare against.
   * @returns `true` when `other` equals this pair's {@link invert | inverse}.
   */
  matchesInverted(other: CurrencyPair): boolean {
    return this.equals(other.invert());
  }

  /**
   * @returns The `BASE/QUOTE` code (same as {@link code}).
   */
  toString(): string {
    return this.code;
  }
}
