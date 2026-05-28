/**
 * Round-trip tests for the serialize/hydrate layer: every value object must
 * survive serialize → hydrate with its underlying value intact. These guard
 * the persistence boundary (DB / JSON) against silent precision or unit drift.
 */
import { describe, it, expect } from "vitest";
import { Currency, Money, Percentage, UTCDate } from "@domain/valueObjects";
import { CashFlow, CashFlowSchedule, CouponPayment } from "@domain/formulas";
import { unwrap } from "../helpers/result";
import {
  serializeMoney,
  serializePercentage,
  serializeDate,
  serializeCouponPayment,
  serializeCashFlow,
  serializeCashFlowSchedule,
} from "@application/calculations/serialize";
import {
  hydrateMoney,
  hydratePercentageFromPercent,
  hydrateDate,
  hydrateCurrency,
  hydrateCouponPayment,
  hydrateCouponSchedule,
} from "@application/calculations/hydrate";

const EUR = unwrap(Currency.create("EUR"));

describe("serialize/hydrate — Money", () => {
  it("round-trips amount and currency", () => {
    const money = unwrap(Money.create(1_234_567.89, EUR));
    const serialized = serializeMoney(money);

    expect(serialized).toEqual({ amount: 1_234_567.89, currency: "EUR" });

    const hydrated = unwrap(hydrateMoney(serialized.amount, serialized.currency));
    expect(hydrated.amount).toBe(money.amount);
    expect(hydrated.currency.code).toBe(money.currency.code);
  });

  it("round-trips a zero amount", () => {
    const money = unwrap(Money.zero(EUR));
    const serialized = serializeMoney(money);
    const hydrated = unwrap(hydrateMoney(serialized.amount, serialized.currency));
    expect(hydrated.amount).toBe(0);
    expect(hydrated.currency.code).toBe("EUR");
  });
});

describe("serialize/hydrate — Percentage", () => {
  it("round-trips via the percent representation", () => {
    const pct = unwrap(Percentage.fromDecimal(0.035));
    const serialized = serializePercentage(pct);

    expect(serialized.asDecimal).toBeCloseTo(0.035, 10);
    expect(serialized.asPercent).toBeCloseTo(3.5, 10);

    const hydrated = unwrap(hydratePercentageFromPercent(serialized.asPercent));
    expect(hydrated.asDecimal).toBeCloseTo(pct.asDecimal, 10);
    expect(hydrated.asPercent).toBeCloseTo(pct.asPercent, 10);
    expect(hydrated.equals(pct)).toBe(true);
  });
});

describe("serialize/hydrate — UTCDate", () => {
  it("round-trips an ISO date", () => {
    const date = unwrap(UTCDate.fromString("2026-07-03"));
    const serialized = serializeDate(date);

    expect(serialized).toBe("2026-07-03");

    const hydrated = unwrap(hydrateDate(serialized));
    expect(hydrated.toISOString()).toBe(date.toISOString());
    expect(hydrated.equals(date)).toBe(true);
  });
});

describe("serialize/hydrate — Currency", () => {
  it("hydrates a currency code", () => {
    const hydrated = unwrap(hydrateCurrency("EUR"));
    expect(hydrated.code).toBe("EUR");
  });
});

describe("serialize/hydrate — CouponPayment", () => {
  it("round-trips a single coupon payment", () => {
    const coupon: CouponPayment = {
      paymentDate: unwrap(UTCDate.fromString("2026-07-03")),
      periodStartDate: unwrap(UTCDate.fromString("2025-07-03")),
      periodEndDate: unwrap(UTCDate.fromString("2026-07-03")),
      isRegular: true,
    };

    const serialized = serializeCouponPayment(coupon);
    expect(serialized).toEqual({
      paymentDate: "2026-07-03",
      periodStartDate: "2025-07-03",
      periodEndDate: "2026-07-03",
      isRegular: true,
    });

    const hydrated = unwrap(hydrateCouponPayment(serialized));
    expect(hydrated.paymentDate.equals(coupon.paymentDate)).toBe(true);
    expect(hydrated.periodStartDate.equals(coupon.periodStartDate)).toBe(true);
    expect(hydrated.periodEndDate.equals(coupon.periodEndDate)).toBe(true);
    expect(hydrated.isRegular).toBe(coupon.isRegular);
  });

  it("round-trips a coupon schedule", () => {
    const schedule: CouponPayment[] = [
      {
        paymentDate: unwrap(UTCDate.fromString("2025-07-03")),
        periodStartDate: unwrap(UTCDate.fromString("2024-07-03")),
        periodEndDate: unwrap(UTCDate.fromString("2025-07-03")),
        isRegular: true,
      },
      {
        paymentDate: unwrap(UTCDate.fromString("2026-07-03")),
        periodStartDate: unwrap(UTCDate.fromString("2025-07-03")),
        periodEndDate: unwrap(UTCDate.fromString("2026-07-03")),
        isRegular: false,
      },
    ];

    const serialized = schedule.map(serializeCouponPayment);
    const hydrated = unwrap(hydrateCouponSchedule(serialized));

    expect(hydrated).toHaveLength(schedule.length);
    hydrated.forEach((coupon, i) => {
      expect(coupon.paymentDate.equals(schedule[i].paymentDate)).toBe(true);
      expect(coupon.periodStartDate.equals(schedule[i].periodStartDate)).toBe(true);
      expect(coupon.periodEndDate.equals(schedule[i].periodEndDate)).toBe(true);
      expect(coupon.isRegular).toBe(schedule[i].isRegular);
    });
  });
});

describe("serialize — CashFlow & CashFlowSchedule", () => {
  it("serializes a cash flow with money round-tripping through hydrate", () => {
    const cashFlow: CashFlow = {
      date: unwrap(UTCDate.fromString("2026-07-03")),
      amount: unwrap(Money.create(35_000, EUR)),
      type: "COUPON",
      description: "Annual coupon",
    };

    const serialized = serializeCashFlow(cashFlow);
    expect(serialized.date).toBe("2026-07-03");
    expect(serialized.type).toBe("COUPON");
    expect(serialized.description).toBe("Annual coupon");
    expect(serialized.amount).toEqual({ amount: 35_000, currency: "EUR" });

    const hydratedDate = unwrap(hydrateDate(serialized.date));
    const hydratedAmount = unwrap(
      hydrateMoney(serialized.amount.amount, serialized.amount.currency)
    );
    expect(hydratedDate.equals(cashFlow.date)).toBe(true);
    expect(hydratedAmount.amount).toBe(cashFlow.amount.amount);
    expect(hydratedAmount.currency.code).toBe(cashFlow.amount.currency.code);
  });

  it("serializes a full cash flow schedule with consistent totals", () => {
    const settlementDate = unwrap(UTCDate.fromString("2026-01-20"));
    const inflow = unwrap(Money.create(35_000, EUR));
    const outflow = unwrap(Money.create(1_040_000, EUR));
    const net = unwrap(Money.create(-1_005_000, EUR));

    const schedule: CashFlowSchedule = {
      bondId: "XS284124583",
      currency: EUR,
      settlementDate,
      cashFlows: [
        {
          date: settlementDate,
          amount: unwrap(Money.create(-1_040_000, EUR)),
          type: "INITIAL_OUTFLOW",
          description: "Purchase",
        },
        {
          date: unwrap(UTCDate.fromString("2026-07-03")),
          amount: inflow,
          type: "COUPON",
          description: "Coupon",
        },
      ],
      totalInflows: inflow,
      totalOutflows: outflow,
      netCashFlow: net,
    };

    const serialized = serializeCashFlowSchedule(schedule);

    expect(serialized.bondId).toBe("XS284124583");
    expect(serialized.currency).toBe("EUR");
    expect(serialized.settlementDate).toBe("2026-01-20");
    expect(serialized.cashFlows).toHaveLength(2);
    expect(serialized.totalInflows).toEqual({ amount: 35_000, currency: "EUR" });
    expect(serialized.totalOutflows).toEqual({ amount: 1_040_000, currency: "EUR" });
    expect(serialized.netCashFlow).toEqual({ amount: -1_005_000, currency: "EUR" });

    // Each serialized cash flow hydrates back to its original money value.
    serialized.cashFlows.forEach((cf, i) => {
      const hydratedAmount = unwrap(
        hydrateMoney(cf.amount.amount, cf.amount.currency)
      );
      expect(hydratedAmount.amount).toBe(schedule.cashFlows[i].amount.amount);
      expect(unwrap(hydrateDate(cf.date)).equals(schedule.cashFlows[i].date)).toBe(
        true
      );
    });
  });
});
