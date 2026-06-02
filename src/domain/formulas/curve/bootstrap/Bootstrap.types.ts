import { Percentage, CurveInterpolation } from "@domain/valueObjects";

/**
 * A short-end pillar supplied directly as a zero (spot) rate rather than
 * bootstrapped from a coupon instrument.
 *
 * Use these to pin the front of the curve (e.g. money-market / deposit tenors)
 * where there is no coupon bond to solve. The rate is taken as the curve's zero
 * rate at `tenor`, discrete annual compounding.
 *
 * @category Results & Types
 */
export interface ZeroRatePillar {
  kind: "ZERO_RATE";
  tenor: number; // years; strictly > 0
  rate: Percentage; // zero (spot) rate, discrete annual
}

/**
 * A coupon-bearing bond quoted **at par** (dirty price = 100% of par), from
 * which the bootstrap solves the discount factor at its maturity.
 *
 * The bond is assumed to settle today (`t = 0`) with coupons falling on a
 * regular `frequency`-per-year grid back from `tenor`: the last coupon (and the
 * 100%-of-par principal) lands at `tenor`, the previous at `tenor - 1/frequency`,
 * and so on. Every coupon before maturity must fall on a tenor the bootstrap has
 * already solved (i.e. it is `<=` the previous pillar's tenor), so its discount
 * factor is known from the partial curve; the maturity discount factor is then
 * the single unknown and is solved algebraically.
 *
 * @category Results & Types
 */
export interface ParBondPillar {
  kind: "PAR_BOND";
  tenor: number; // years to maturity; strictly > 0
  couponRate: Percentage; // annual coupon rate, discrete
  frequency: number; // coupons per year; integer >= 1
}

/**
 * One instrument the bootstrap consumes: either a directly-supplied zero rate
 * (front of the curve) or a par bond (from which a discount factor is solved).
 *
 * @category Results & Types
 */
export type BootstrapInstrument = ZeroRatePillar | ParBondPillar;

/**
 * Input to the sequential par bootstrap.
 *
 * @category Results & Types
 */
export interface BootstrapInput {
  /** The observed instruments. Need not be pre-sorted by tenor. */
  instruments: BootstrapInstrument[];
  /** Interpolation method for the resulting curve; defaults to LOG_LINEAR_DF. */
  interpolation?: CurveInterpolation;
}

/**
 * A solved curve pillar: the tenor and the discount factor the bootstrap
 * determined there.
 *
 * @category Results & Types
 */
export interface BootstrappedPillar {
  tenor: number;
  df: number;
}
