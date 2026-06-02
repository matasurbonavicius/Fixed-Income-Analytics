import {
  CashFlowOptions,
  DiscountRateOptions,
} from "@domain/formulas";
import {UTCDate} from "@domain/valueObjects";

/**
 * How the engine discounts cash flows to a price.
 *
 * - `flat_yield` (default) - discount every flow at one flat periodic rate
 *   `y/f`. The original, golden-pinned behaviour.
 * - `curve` - discount each flow `k` at the supplied yield curve's `DF(t_k)`.
 *   Opt-in; requires a yield curve for the bond's analytical currency in the
 *   market-data snapshot.
 *
 * @category Services
 */
export type PricingMode = "flat_yield" | "curve";

/**
 * Inputs accepted by the {@link BondFormulaOptions} constructor.
 *
 * This is the plain-object shape callers assemble; the constructor copies it
 * field-for-field into a {@link BondFormulaOptions} instance.
 *
 * @category Services
 */
export interface BondFormulaOptionsInput {
  /**
   * Trade settlement date - when cash and securities change hands. Cash-flow
   * schedules drop any coupon falling on or before this date, and accrued
   * interest is measured from the last coupon up to it.
   */
  settlementDate: UTCDate;
  /**
   * Valuation "as of" date used to select the {@link MarketData} snapshot
   * (prices, curves, spreads, FX) that the formulas discount against. Often
   * equal to {@link BondFormulaOptionsInput.settlementDate}, but kept separate
   * so a trade can be valued against an earlier or later market view.
   */
  analysisDate: UTCDate;
  /** Discount-rate sourcing policy; omit to use the default method waterfall. */
  discountRate?: DiscountRateOptions;
  /** Cash-flow shaping options; omit to use formula defaults. */
  cashFlow?: CashFlowOptions;
  /**
   * How to discount cash flows to a price. Omit for `"flat_yield"`, the
   * original flat-rate behaviour; set `"curve"` to discount off the yield
   * curve in the market-data snapshot (see {@link PricingMode}).
   */
  pricingMode?: PricingMode;
}

/**
 * Run configuration for a single bond valuation passed to the
 * {@link CalculationEngine} and the registered formula set.
 *
 * It pins down three things every formula in a run shares:
 *
 * - **The dates.** {@link settlementDate} drives accrual and which coupons
 *   remain; {@link analysisDate} picks the market-data snapshot to value
 *   against.
 * - **Where the discount rate comes from.** {@link discountRate} carries an
 *   ordered *waterfall* of {@link DiscountRateMethod}s - see {@link discountRate}
 *   below - letting a run prefer, say, a market-implied rate but fall back to a
 *   rating-based spread when no price is observed.
 * - **How cash flows are shaped.** {@link cashFlow} toggles details such as
 *   whether the purchase price is booked as an initial outflow (turning the
 *   schedule into a full IRR-style series).
 *
 * @remarks
 * This is an immutable value object: the constructor snapshots its input and
 * the engine never mutates it. Build one per valuation run.
 *
 * @example
 * ```ts
 * const options = new BondFormulaOptions({
 *   settlementDate,
 *   analysisDate: settlementDate,
 *   discountRate: { methods: ["implied_from_price", "official_rating"] },
 *   cashFlow: { includeInitialOutflow: true },
 * });
 * ```
 *
 * @category Services
 */
export class BondFormulaOptions {
  /**
   * Trade settlement date - when cash and securities change hands. Cash-flow
   * schedules drop any coupon falling on or before this date, and accrued
   * interest is measured from the last coupon up to it.
   */
  settlementDate: UTCDate;
  /**
   * Valuation "as of" date used to select the {@link MarketData} snapshot the
   * formulas discount against. May differ from {@link settlementDate}.
   */
  analysisDate: UTCDate;
  /**
   * Discount-rate sourcing policy. Its `methods` array is an **ordered
   * waterfall**: the engine tries each {@link DiscountRateMethod} in turn and
   * the first one that can produce a rate wins. The default order is
   * `implied_from_price` → `official_rating` → `internal_rating` →
   * `manual_spread` → `manual_rate` (see `DEFAULT_DISCOUNT_RATE_METHODS`),
   * i.e. prefer a rate backed out of an observed market price, then a spread
   * from an official credit rating, then an internal rating, then a manual
   * spread override, and finally a directly supplied manual rate. Undefined
   * means use that default order.
   */
  discountRate?: DiscountRateOptions;
  /**
   * Cash-flow shaping options, e.g. `includeInitialOutflow` to book the
   * purchase price as a negative cash flow at settlement. Undefined uses
   * formula defaults.
   */
  cashFlow?: CashFlowOptions;
  /**
   * How to discount cash flows to a price. Undefined means `"flat_yield"`,
   * the original flat-rate behaviour; `"curve"` discounts off the snapshot's
   * yield curve (see {@link PricingMode}).
   */
  pricingMode?: PricingMode;

  /**
   * @param options - The {@link BondFormulaOptionsInput} to snapshot. Each
   *   field is copied onto the instance.
   */
  constructor(options: BondFormulaOptionsInput) {
    this.settlementDate = options.settlementDate;
    this.analysisDate = options.analysisDate;
    this.discountRate = options.discountRate;
    this.cashFlow = options.cashFlow;
    this.pricingMode = options.pricingMode;
  }
}
