import { Result, ResultHelper } from "@domain/shared";
import { Currency, Money, Percentage, UTCDate } from "@domain/valueObjects";
import { CouponPayment } from "@domain/formulas";

export function hydrateCurrency(code: string): Result<Currency> {
  return Currency.create(code);
}

export function hydrateMoney(amount: number, currencyCode: string): Result<Money> {
  const currencyResult = Currency.create(currencyCode);
  if (!currencyResult.success) return currencyResult;
  return Money.create(amount, currencyResult.value);
}

export function hydratePercentageFromPercent(value: number): Result<Percentage> {
  return Percentage.fromPercent(value);
}

export function hydrateDate(s: string): Result<UTCDate> {
  return UTCDate.fromString(s);
}

export interface RawCouponPayment {
  paymentDate: string;
  periodStartDate: string;
  periodEndDate: string;
  isRegular: boolean;
}

export function hydrateCouponPayment(raw: RawCouponPayment): Result<CouponPayment> {
  const pmt = UTCDate.fromString(raw.paymentDate);
  if (!pmt.success) return pmt;
  const psd = UTCDate.fromString(raw.periodStartDate);
  if (!psd.success) return psd;
  const ped = UTCDate.fromString(raw.periodEndDate);
  if (!ped.success) return ped;
  return ResultHelper.success({
    paymentDate: pmt.value,
    periodStartDate: psd.value,
    periodEndDate: ped.value,
    isRegular: raw.isRegular,
  });
}

export function hydrateCouponSchedule(raw: RawCouponPayment[]): Result<CouponPayment[]> {
  const out: CouponPayment[] = [];
  for (const r of raw) {
    const result = hydrateCouponPayment(r);
    if (!result.success) return result;
    out.push(result.value);
  }
  return ResultHelper.success(out);
}
