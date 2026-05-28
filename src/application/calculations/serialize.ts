import { Money, Percentage, UTCDate } from "@domain/valueObjects";
import { CashFlow, CashFlowSchedule, CouponPayment } from "@domain/formulas";

export interface SerializedMoney {
  amount: number;
  currency: string;
}

export interface SerializedPercentage {
  asDecimal: number;
  asPercent: number;
}

export const serializeMoney = (m: Money): SerializedMoney => ({
  amount: m.amount,
  currency: m.currency.code,
});

export const serializePercentage = (p: Percentage): SerializedPercentage => ({
  asDecimal: p.asDecimal,
  asPercent: p.asPercent,
});

export const serializeDate = (d: UTCDate): string => d.toISOString();

export const serializeCouponPayment = (c: CouponPayment) => ({
  paymentDate: serializeDate(c.paymentDate),
  periodStartDate: serializeDate(c.periodStartDate),
  periodEndDate: serializeDate(c.periodEndDate),
  isRegular: c.isRegular,
});

export const serializeCashFlow = (c: CashFlow) => ({
  date: serializeDate(c.date),
  amount: serializeMoney(c.amount),
  type: c.type,
  description: c.description,
});

export const serializeCashFlowSchedule = (s: CashFlowSchedule) => ({
  bondId: s.bondId,
  currency: s.currency.code,
  settlementDate: serializeDate(s.settlementDate),
  cashFlows: s.cashFlows.map(serializeCashFlow),
  totalInflows: serializeMoney(s.totalInflows),
  totalOutflows: serializeMoney(s.totalOutflows),
  netCashFlow: serializeMoney(s.netCashFlow),
});
