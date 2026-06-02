import { Percentage, UTCDate, DiscountCurve } from "@domain/valueObjects";
import { DayCountConvention, CouponPayment } from "@domain/formulas";

/**
 * Input for solving the Z-spread of a fixed-rate bond against a curve.
 *
 * The Z-spread is the single spread added to every zero rate of `curve` such
 * that discounting the bond's cash flows reprices it to `dirtyPrice`.
 *
 * @category Results & Types
 */
export interface ZSpreadFixedInput {
  dirtyPrice: Percentage; // observed market dirty price, as % of par
  fixedRate: Percentage;
  frequency: number;
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  futureCoupons: CouponPayment[];
  curve: DiscountCurve;
  dayCountConvention: DayCountConvention;
}

/**
 * Input for solving the Z-spread of a zero-coupon bond against a curve.
 *
 * @category Results & Types
 */
export interface ZSpreadZeroInput {
  dirtyPrice: Percentage; // observed market dirty price, as % of par
  settlementDate: UTCDate;
  maturityDate: UTCDate;
  curve: DiscountCurve;
  dayCountConvention: DayCountConvention;
}

/**
 * Input for the simple curve-relative spreads (I-spread and, optionally,
 * G-spread), each defined as the bond's yield minus a curve's zero rate at the
 * bond's remaining life.
 *
 * @category Results & Types
 */
export interface SimpleSpreadInput {
  bondYield: Percentage; // the bond's yield to maturity
  yearsToMaturity: number; // remaining life, in years
  curve: DiscountCurve; // the swap/benchmark curve (I-spread)
  govvieCurve?: DiscountCurve; // optional government curve (G-spread)
}

/**
 * The set of curve-relative spreads for a bond.
 *
 * `zSpread` is the headline number - the parallel shift of the whole zero
 * curve that reprices the bond. `iSpread` and `gSpread` are the simpler
 * "yield minus the curve at the bond's life" measures; `gSpread` is present
 * only when a government curve was supplied.
 *
 * @category Results & Types
 */
export interface SpreadsResult {
  /** Z-spread: constant add-on to every zero rate that reprices the bond. */
  zSpread: Percentage;
  /** I-spread: bond yield minus the (swap) curve zero rate at the bond's life. */
  iSpread: Percentage;
  /** G-spread: bond yield minus the government curve rate; only if supplied. */
  gSpread?: Percentage;
}
