import { Result, ResultHelper } from "@domain/shared";

export interface CurrencyData {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
}

export class Currency {
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

  static create(code: string): Result<Currency> {
    const upperCode = code.toUpperCase();
    if (!Currency.CURRENCIES[upperCode]) {
      return ResultHelper.failure(`Unsupported currency code: ${code}`);
    }
    return ResultHelper.success(new Currency(upperCode));
  }

  get code(): string {
    return this._code;
  }

  get symbol(): string {
    return Currency.CURRENCIES[this._code]?.symbol || this._code;
  }

  get name(): string {
    return Currency.CURRENCIES[this._code]?.name || this._code;
  }

  get decimals(): number {
    // Use ?? (not ||) so a legitimate 0-decimal currency (e.g. JPY) is honoured.
    return Currency.CURRENCIES[this._code]?.decimals ?? 2;
  }

  equals(other: Currency): boolean {
    return this._code === other._code;
  }

  toString(): string {
    return this._code;
  }
}
