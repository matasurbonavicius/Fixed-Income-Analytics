/**
 * Tests for the per-formula input validators (DirtyPrice / CleanPrice /
 * Duration / AccruedInterest / CashFlows, fixed & zero variants). These compose
 * the shared field validators and add date-relationship / coupon checks. We hit
 * both the success path and the failure path (settlement >= maturity, missing
 * coupons, bad prices) which the engine golden tests never trigger.
 */
import { describe, it, expect } from "vitest";
import {
  validateDirtyPriceFixed,
  validateDirtyPriceZero,
  validateCleanPriceFixed,
  validateCleanPriceZero,
  validateDurationFixed,
  validateDurationZero,
  validateAccruedInterestFixed,
  validateAccruedInterestZero,
  validateCashFlowFixed,
  validateCashFlowZero,
  type CouponPayment,
} from "@domain/formulas";
import { Currency, Money, Percentage, UTCDate } from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";

const EUR = unwrap(Currency.create("EUR"));
const FACE = unwrap(Money.create(1_000_000, EUR));

function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}
function d(iso: string): UTCDate {
  return unwrap(UTCDate.fromString(iso));
}

const SETTLE = d("2026-01-20");
const MATURITY = d("2031-01-03");
const COUPONS: CouponPayment[] = [
  {
    paymentDate: d("2027-01-03"),
    periodStartDate: d("2026-01-03"),
    periodEndDate: d("2027-01-03"),
    isRegular: true,
  },
];

function accrued() {
  return {
    amountMoney: unwrap(Money.create(1000, EUR)),
    amountPercent: pct(0.001),
    accruedDays: 30,
    periodStartDate: d("2026-01-03"),
    periodEndDate: d("2027-01-03"),
    settlementDate: SETTLE,
  };
}

describe("validateDirtyPriceFixed", () => {
  const base = {
    faceValue: FACE,
    fixedRate: pct(0.035),
    frequency: 1,
    currency: EUR,
    settlementDate: SETTLE,
    maturityDate: MATURITY,
    futureCoupons: COUPONS,
    discountRate: pct(0.03),
    dayCountConvention: "ACT_ACT" as const,
    compoundingFrequency: 1,
  };
  it("accepts valid input", () => {
    expect(validateDirtyPriceFixed(base).success).toBe(true);
  });
  it("rejects settlement on/after maturity", () => {
    const r = validateDirtyPriceFixed({ ...base, settlementDate: MATURITY });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain("before maturity");
  });
  it("rejects a negative discount rate", () => {
    expect(validateDirtyPriceFixed({ ...base, discountRate: pct(-0.01) }).success).toBe(false);
  });
});

describe("validateDirtyPriceZero", () => {
  const base = {
    faceValue: FACE,
    currency: EUR,
    settlementDate: SETTLE,
    maturityDate: MATURITY,
    discountRate: pct(0.03),
    dayCountConvention: "ACT_ACT" as const,
    compoundingFrequency: 1,
  };
  it("accepts valid input", () => {
    expect(validateDirtyPriceZero(base).success).toBe(true);
  });
  it("rejects settlement on/after maturity", () => {
    expect(validateDirtyPriceZero({ ...base, settlementDate: MATURITY }).success).toBe(false);
  });
});

describe("validateCleanPriceFixed / Zero", () => {
  it("fixed accepts a positive dirty price with valid accrued", () => {
    expect(
      validateCleanPriceFixed({ dirtyPrice: pct(1.04), accruedInterest: accrued() }).success
    ).toBe(true);
  });
  it("fixed rejects a zero dirty price", () => {
    expect(
      validateCleanPriceFixed({ dirtyPrice: pct(0), accruedInterest: accrued() }).success
    ).toBe(false);
  });
  it("zero accepts a positive dirty price", () => {
    expect(validateCleanPriceZero({ dirtyPrice: pct(0.95) }).success).toBe(true);
  });
  it("zero rejects a negative dirty price", () => {
    expect(validateCleanPriceZero({ dirtyPrice: pct(-0.1) }).success).toBe(false);
  });
});

describe("validateDurationFixed", () => {
  const base = {
    faceValue: FACE,
    fixedRate: pct(0.035),
    frequency: 1,
    yield: pct(0.03),
    currency: EUR,
    cleanPrice: pct(1.02),
    settlementDate: SETTLE,
    maturityDate: MATURITY,
    futureCoupons: COUPONS,
    dayCountConvention: "ACT_ACT" as const,
    compoundingFrequency: 1,
  };
  it("accepts valid input", () => {
    expect(validateDurationFixed(base).success).toBe(true);
  });
  it("rejects empty future coupons", () => {
    const r = validateDurationFixed({ ...base, futureCoupons: [] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toContain("Future coupons");
  });
  it("rejects a non-positive compounding frequency", () => {
    expect(validateDurationFixed({ ...base, compoundingFrequency: 0 }).success).toBe(false);
  });
  it("rejects a non-positive clean price", () => {
    expect(validateDurationFixed({ ...base, cleanPrice: pct(0) }).success).toBe(false);
  });
});

describe("validateDurationZero", () => {
  const base = {
    analyticalCurrency: EUR,
    faceValue: FACE,
    currency: EUR,
    cleanPrice: pct(0.95),
    discountRate: pct(0.03),
    settlementDate: SETTLE,
    maturityDate: MATURITY,
    dayCountConvention: "ACT_ACT" as const,
  };
  it("accepts valid input", () => {
    expect(validateDurationZero(base).success).toBe(true);
  });
  it("rejects a negative yield and a non-positive clean price", () => {
    expect(validateDurationZero({ ...base, discountRate: pct(-0.01) }).success).toBe(false);
    expect(validateDurationZero({ ...base, cleanPrice: pct(0) }).success).toBe(false);
  });
  it("rejects settlement on/after maturity", () => {
    expect(validateDurationZero({ ...base, settlementDate: MATURITY }).success).toBe(false);
  });
});

describe("validateAccruedInterestFixed / Zero", () => {
  const base = {
    faceValue: FACE,
    fixedRate: pct(0.035),
    frequency: 1,
    periodStartDate: d("2026-01-03"),
    periodEndDate: d("2027-01-03"),
    settlementDate: SETTLE,
    dayCountConvention: "ACT_ACT" as const,
  };
  it("fixed accepts a settlement within the coupon period", () => {
    expect(validateAccruedInterestFixed(base).success).toBe(true);
  });
  it("fixed rejects period start on/after period end", () => {
    const r = validateAccruedInterestFixed({
      ...base,
      periodStartDate: d("2027-01-03"),
      periodEndDate: d("2026-01-03"),
    });
    expect(r.success).toBe(false);
  });
  it("fixed rejects a settlement before the period start", () => {
    expect(
      validateAccruedInterestFixed({ ...base, settlementDate: d("2025-12-01") }).success
    ).toBe(false);
  });
  it("fixed rejects a settlement after the period end", () => {
    expect(
      validateAccruedInterestFixed({ ...base, settlementDate: d("2027-06-01") }).success
    ).toBe(false);
  });
  it("zero validation always succeeds (no accrual)", () => {
    expect(validateAccruedInterestZero().success).toBe(true);
  });
});

describe("validateCashFlowFixed / Zero", () => {
  const fixedBase = {
    bondId: "B1",
    faceValue: FACE,
    fixedRate: pct(0.035),
    frequency: 1,
    currency: EUR,
    settlementDate: SETTLE,
    maturityDate: MATURITY,
    futureCoupons: COUPONS,
    dayCountConvention: "ACT_ACT" as const,
  };
  it("fixed accepts valid input", () => {
    expect(validateCashFlowFixed(fixedBase).success).toBe(true);
  });
  it("fixed rejects settlement on/after maturity", () => {
    expect(validateCashFlowFixed({ ...fixedBase, settlementDate: MATURITY }).success).toBe(false);
  });
  it("zero accepts valid input", () => {
    expect(
      validateCashFlowZero({
        bondId: "B2",
        faceValue: FACE,
        currency: EUR,
        settlementDate: SETTLE,
        maturityDate: MATURITY,
      }).success
    ).toBe(true);
  });
  it("zero rejects a below-minimum face value", () => {
    expect(
      validateCashFlowZero({
        bondId: "B2",
        faceValue: unwrap(Money.create(10, EUR)),
        currency: EUR,
        settlementDate: SETTLE,
        maturityDate: MATURITY,
      }).success
    ).toBe(false);
  });
});
