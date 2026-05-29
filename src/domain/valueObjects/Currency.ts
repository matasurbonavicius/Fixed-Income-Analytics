import { Result, ResultHelper } from "@domain/shared";

/**
 * The static metadata backing a {@link Currency}: its ISO code, display
 * symbol, human-readable name, and the number of minor-unit decimals
 * conventionally used for formatting.
 *
 * @internal
 */
export interface CurrencyData {
  /** ISO 4217 alphabetic code, e.g. `"USD"`. */
  code: string;
  /** Display symbol, e.g. `"$"` or `"€"`. */
  symbol: string;
  /** Full name, e.g. `"US Dollar"`. */
  name: string;
  /** Conventional fractional digits (e.g. `2` for USD, `0` for JPY). */
  decimals: number;
}

/**
 * An immutable, validated ISO 4217 currency.
 *
 * A `Currency` is constructed only from a code the library recognizes, so a
 * typo or an unsupported denomination is caught at the boundary rather than
 * propagating into a {@link Money} amount. Beyond identity it carries the
 * presentation metadata ({@link symbol}, {@link name}, {@link decimals}) needed
 * to format amounts correctly - notably the per-currency decimal count, which
 * is why a JPY figure prints with no decimals while USD prints with two.
 *
 * @example
 * ```ts
 * const usd = Currency.create("usd").value; // codes are normalized to upper-case
 * usd.symbol;   // "$"
 * usd.decimals; // 2
 * ```
 *
 * @remarks
 * **Supported currencies.** {@link create} accepts only the ISO 4217 codes
 * below; anything else fails. Decimals drive formatting (JPY prints with none).
 *
 * | Code | Symbol | Name | Decimals |
 * |------|--------|------|:--------:|
 * | EUR | € | Euro | 2 |
 * | USD | $ | US Dollar | 2 |
 * | GBP | £ | British Pound | 2 |
 * | CHF | Fr | Swiss Franc | 2 |
 * | JPY | ¥ | Japanese Yen | 0 |
 * | SEK | kr | Swedish Krona | 2 |
 * | NOK | kr | Norwegian Krone | 2 |
 * | DKK | kr | Danish Krone | 2 |
 * | PLN | zł | Polish Zloty | 2 |
 * | CZK | Kč | Czech Koruna | 2 |
 * | HUF | Ft | Hungarian Forint | 2 |
 * | RON | lei | Romanian Leu | 2 |
 * | BGN | лв | Bulgarian Lev | 2 |
 * | HRK | kn | Croatian Kuna | 2 |
 * | RUB | ₽ | Russian Ruble | 2 |
 * | TRY | ₺ | Turkish Lira | 2 |
 * | AUD | A$ | Australian Dollar | 2 |
 * | CAD | C$ | Canadian Dollar | 2 |
 * | CNY | ¥ | Chinese Yuan | 2 |
 * | INR | ₹ | Indian Rupee | 2 |
 *
 * @category Value Objects
 */
export class Currency {
  // NOTE: keep the class-level @remarks currency table in sync with this map.
  private static readonly CURRENCIES: Record<string, CurrencyData> = {
    EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
    USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
    GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
    CHF: { code: "CHF", symbol: "Fr", name: "Swiss Franc", decimals: 2 },
    JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
    SEK: { code: "SEK", symbol: "kr", name: "Swedish Krona", decimals: 2 },
    NOK: { code: "NOK", symbol: "kr", name: "Norwegian Krone", decimals: 2 },
    DKK: { code: "DKK", symbol: "kr", name: "Danish Krone", decimals: 2 },
    PLN: { code: "PLN", symbol: "zł", name: "Polish Zloty", decimals: 2 },
    CZK: { code: "CZK", symbol: "Kč", name: "Czech Koruna", decimals: 2 },
    HUF: { code: "HUF", symbol: "Ft", name: "Hungarian Forint", decimals: 2 },
    RON: { code: "RON", symbol: "lei", name: "Romanian Leu", decimals: 2 },
    BGN: { code: "BGN", symbol: "лв", name: "Bulgarian Lev", decimals: 2 },
    HRK: { code: "HRK", symbol: "kn", name: "Croatian Kuna", decimals: 2 },
    RUB: { code: "RUB", symbol: "₽", name: "Russian Ruble", decimals: 2 },
    TRY: { code: "TRY", symbol: "₺", name: "Turkish Lira", decimals: 2 },
    AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
    CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2 },
    CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", decimals: 2 },
    INR: { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
  };

  constructor(private readonly _code: string) {}

  /**
   * Creates a {@link Currency} from an ISO 4217 code.
   *
   * The code is normalized to upper-case and checked against the supported set,
   * so unrecognized codes fail rather than producing a half-defined currency.
   *
   * @param code - The currency code (case-insensitive), e.g. `"USD"`.
   * @returns The {@link Currency}, or a failure for an unsupported code. Never
   *   throws.
   */
  static create(code: string): Result<Currency> {
    const upperCode = code.toUpperCase();
    if (!Currency.CURRENCIES[upperCode]) {
      return ResultHelper.failure(`Unsupported currency code: ${code}`);
    }
    return ResultHelper.success(new Currency(upperCode));
  }

  /** The ISO 4217 code (upper-case), e.g. `"USD"`. */
  get code(): string {
    return this._code;
  }

  /** The display symbol, e.g. `"$"`; falls back to the code if unknown. */
  get symbol(): string {
    return Currency.CURRENCIES[this._code]?.symbol || this._code;
  }

  /** The full currency name, e.g. `"US Dollar"`; falls back to the code. */
  get name(): string {
    return Currency.CURRENCIES[this._code]?.name || this._code;
  }

  /**
   * The conventional number of fractional digits used when formatting amounts.
   *
   * @returns The decimal count (e.g. `2` for USD, `0` for JPY); defaults to `2`.
   */
  get decimals(): number {
    // Use ?? (not ||) so a legitimate 0-decimal currency (e.g. JPY) is honoured.
    return Currency.CURRENCIES[this._code]?.decimals ?? 2;
  }

  /**
   * Tests whether two currencies are the same denomination.
   *
   * Used by {@link Money} to reject cross-currency arithmetic.
   *
   * @param other - The {@link Currency} to compare against.
   * @returns `true` when the codes match.
   */
  equals(other: Currency): boolean {
    return this._code === other._code;
  }

  /**
   * @returns The ISO code, e.g. `"USD"`.
   */
  toString(): string {
    return this._code;
  }
}
