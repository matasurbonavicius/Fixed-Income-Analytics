/**
 * Tests for the standalone field validators. Each returns string[] of errors
 * (empty == valid). We exercise both the accept and the reject branches so the
 * error-message paths (previously uncovered) are hit.
 */
import { describe, it, expect } from "vitest";
import {
  validateFaceValue,
  validateFixedRate,
  validateFrequency,
  validateMarketPrice,
  validateCleanPrice,
  validateDirtyPrice,
  validateDiscountRate,
  validateAccruedInterest,
  validatePositions,
} from "@domain/formulas";
import { Currency, Money, Percentage } from "@domain/valueObjects";
import { unwrap } from "../../helpers/result";
import { makeFixedRateBond } from "../../fixtures/bonds";

const EUR = unwrap(Currency.create("EUR"));
const USD = unwrap(Currency.create("USD"));

function money(amount: number): Money {
  return unwrap(Money.create(amount, EUR));
}
function pct(decimal: number): Percentage {
  return unwrap(Percentage.fromDecimal(decimal));
}

describe("validateFaceValue", () => {
  it("accepts a normal positive face value", () => {
    expect(validateFaceValue(money(1000))).toEqual([]);
  });
  it("rejects zero", () => {
    const errs = validateFaceValue(money(0));
    expect(errs.some((e) => e.includes("cannot be zero"))).toBe(true);
  });
  it("rejects negative and below-minimum values", () => {
    const errs = validateFaceValue(money(-50));
    expect(errs.some((e) => e.includes("must be positive"))).toBe(true);
    expect(errs.some((e) => e.includes("at least"))).toBe(true);
  });
  it("rejects a tiny positive face value below the minimum", () => {
    const errs = validateFaceValue(money(50));
    expect(errs.some((e) => e.includes("at least"))).toBe(true);
  });
});

describe("validateFixedRate", () => {
  it("accepts a rate within [0, 1]", () => {
    expect(validateFixedRate(pct(0.035))).toEqual([]);
  });
  it("rejects a negative rate", () => {
    expect(validateFixedRate(pct(-0.01))).toContain(
      "Fixed rate cannot be negative"
    );
  });
  it("rejects a rate above 100%", () => {
    expect(validateFixedRate(pct(1.5))).toContain(
      "Fixed rate cannot exceed 100%"
    );
  });
});

describe("validateFrequency", () => {
  it.each([1, 2, 3, 4, 6, 12])("accepts valid frequency %i", (f) => {
    expect(validateFrequency(f)).toEqual([]);
  });
  it.each([0, 5, 7, 13])("rejects invalid frequency %i", (f) => {
    expect(validateFrequency(f).length).toBe(1);
  });
});

describe("validateMarketPrice", () => {
  it("accepts a positive price", () => {
    expect(validateMarketPrice(pct(1.0))).toEqual([]);
  });
  it("rejects a zero price", () => {
    expect(validateMarketPrice(pct(0)).length).toBe(1);
  });
  it("rejects a negative price", () => {
    expect(validateMarketPrice(pct(-0.5)).length).toBe(1);
  });
});

describe("validateCleanPrice", () => {
  it("accepts a positive clean price", () => {
    expect(validateCleanPrice(money(1000))).toEqual([]);
  });
  it("rejects zero", () => {
    expect(validateCleanPrice(money(0))).toContain("Clean price cannot be zero");
  });
  it("rejects negative", () => {
    expect(validateCleanPrice(money(-5))).toContain(
      "Clean price must be positive"
    );
  });
});

describe("validateDirtyPrice", () => {
  it("accepts a positive dirty price", () => {
    expect(validateDirtyPrice(pct(1.04))).toEqual([]);
  });
  it("rejects zero", () => {
    expect(validateDirtyPrice(pct(0))).toContain("Dirty price cannot be zero");
  });
  it("rejects negative", () => {
    expect(validateDirtyPrice(pct(-0.1))).toContain(
      "Dirty price must be positive"
    );
  });
});

describe("validateDiscountRate", () => {
  it("accepts a non-negative rate", () => {
    expect(validateDiscountRate(pct(0.03))).toEqual([]);
  });
  it("rejects a negative rate", () => {
    expect(validateDiscountRate(pct(-0.01))).toContain(
      "Discount rate cannot be negative"
    );
  });
});

describe("validateAccruedInterest", () => {
  it("accepts a non-negative accrued amount", () => {
    expect(
      validateAccruedInterest({ amountPercent: pct(0.01) } as any)
    ).toEqual([]);
  });
  it("rejects a negative accrued amount", () => {
    expect(
      validateAccruedInterest({ amountPercent: pct(-0.01) } as any)
    ).toContain("Accrued interest cannot be negative");
  });
});

describe("validatePositions", () => {
  it("rejects an empty position list", () => {
    const errs = validatePositions([], EUR);
    expect(errs.some((e) => e.includes("no position"))).toBe(true);
  });

  it("flags a position whose bond has no metrics", () => {
    const { bond } = makeFixedRateBond();
    const errs = validatePositions([{ bond, quantity: 1 }], EUR);
    expect(errs.some((e) => e.includes("no metrics"))).toBe(true);
  });

  it("flags invalid quantity and currency mismatch on a bond that has metrics", () => {
    const { bond } = makeFixedRateBond();
    // Attach a minimal metrics object so the no-metrics short-circuit is skipped.
    const withMetrics = bond.update({ metrics: {} as any });
    const errs = validatePositions(
      [{ bond: withMetrics, quantity: 0 }],
      USD // base currency differs from the bond's EUR analytical currency
    );
    expect(errs.some((e) => e.includes("invalid quantity"))).toBe(true);
    expect(errs.some((e) => e.includes("does not match"))).toBe(true);
  });

  it("accepts a well-formed position matching the base currency", () => {
    const { bond } = makeFixedRateBond();
    const withMetrics = bond.update({ metrics: {} as any });
    const errs = validatePositions([{ bond: withMetrics, quantity: 5 }], EUR);
    expect(errs).toEqual([]);
  });
});
