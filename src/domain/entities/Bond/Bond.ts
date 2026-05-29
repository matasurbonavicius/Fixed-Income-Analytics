import { BondProps } from "./Bond.types";
import { Currency } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

/**
 * A fixed-income security: its identity, contractual terms, and a slot for
 * computed analytics.
 *
 * A `Bond` carries everything a valuation needs to know about the instrument
 * itself (see {@link BondProps}):
 *
 * - **Identity & display.** A {@link BondId}, name, issuer and categorization.
 * - **Economic terms.** Face value as {@link Money}, issue/maturity dates as
 *   {@link UTCDate}, the coupon (a fixed {@link Percentage} and payment
 *   frequency, or zero for a zero-coupon bond), day-count and business-day
 *   conventions, and the payment calendar.
 * - **Credit & valuation hints.** An optional {@link CreditRating} plus
 *   overrides (internal rating id, manual spread in bps, a manual
 *   {@link Percentage} discount rate, or a preferred method order) that feed
 *   the discount-rate waterfall.
 * - **Currencies.** The currency the bond was issued in and the analytical
 *   currency it is valued in (defaulted to the issue currency on
 *   {@link create}).
 * - **Computed analytics.** An optional {@link BondMetrics} slot that the
 *   calculation pipeline fills in; the bond itself performs no math.
 *
 * The entity is **immutable**: {@link update}, {@link deleteMetrics} and
 * {@link convertCurrency} all return a new `Bond` rather than mutating in place,
 * so a bond can be shared safely across calculation runs.
 *
 * @example
 * ```ts
 * const bond = Bond.create(fixedRateBondProps);
 * const priced = bond.update({ metrics });        // attach computed analytics
 * const usd = bond.convertCurrency(USD, fxRate);  // -> Result<Bond>
 * ```
 *
 * @category Entities
 */
export class Bond {
  private readonly _props: BondProps;

  private constructor(props: BondProps) {
    this._props = { ...props };
  }

  /**
   * Creates a `Bond` from its terms, applying construction-time defaults.
   *
   * If no `analyticalCurrency` is supplied it defaults to the bond's
   * `issueCurrency`, so the bond is valued in the currency it was issued in
   * unless told otherwise.
   *
   * @param props - The full {@link BondProps} (a fixed-rate or zero-coupon
   *   shape) describing the instrument.
   * @returns The constructed {@link Bond}.
   */
  static create(props: BondProps): Bond {
    const bondProps = {
      ...props,
      // Adding some defaults during the creation phase
      analyticalCurrency: props.analyticalCurrency ?? props.issueCurrency,
    };
    return new Bond(bondProps);
  }

  /** The bond's terms and analytics ({@link BondProps}), read-only. */
  get props(): Readonly<BondProps> {
    return this._props;
  }

  /**
   * Returns a copy of the bond with the given fields overridden.
   *
   * The common use is attaching freshly computed {@link BondMetrics} after a
   * calculation run, but any subset of {@link BondProps} can be patched. The
   * original bond is unchanged.
   *
   * @typeParam T - The {@link BondProps} variant being patched.
   * @param updates - Partial props to merge over the current ones.
   * @returns A new {@link Bond} with the merged props.
   */
  update<T extends BondProps>(updates: Partial<T>): Bond {
    return new Bond({ ...this._props, ...updates } as BondProps);
  }

  /**
   * Returns a copy of the bond with its computed {@link BondMetrics} dropped.
   *
   * Useful when terms change and previously computed analytics no longer apply,
   * so a stale {@link BondMetrics} is not mistaken for a fresh one.
   *
   * @returns A new {@link Bond} with no `metrics`.
   */
  deleteMetrics(): Bond {
    const { metrics: _metrics, ...propsWithoutMetrics } = this._props;
    return new Bond(propsWithoutMetrics as BondProps);
  }

  /**
   * Re-denominates the bond into another currency at a given FX rate.
   *
   * Converts the {@link Money} face value, switches the analytical currency to
   * the target, and clears any cached {@link BondMetrics} (since they were
   * computed in the old currency). If the bond is already in the target
   * currency it is returned unchanged.
   *
   * @param targetCurrency - The {@link Currency} to value the bond in.
   * @param fxRate - Units of target currency per unit of the current analytical
   *   currency. Must be positive and finite.
   * @returns A success {@link Result} with the converted {@link Bond}, or a
   *   failure if the FX rate is invalid or the money conversion fails.
   */
  convertCurrency(targetCurrency: Currency, fxRate: number): Result<Bond> {
    // Early return: already in target currency
    if (this._props.analyticalCurrency.equals(targetCurrency)) {
      return ResultHelper.success(this);
    }

    // Validate FX rate
    if (!Number.isFinite(fxRate) || fxRate <= 0) {
      return ResultHelper.failure(
        `Invalid FX rate: ${fxRate} (must be positive and finite)`
      );
    }

    // Convert faceValue
    const convertedFaceValueResult = this._props.faceValue.convertTo(
      targetCurrency,
      fxRate
    );
    if (!convertedFaceValueResult.success) {
      return convertedFaceValueResult;
    }

    // Return bond with converted fields, updated currency, cleared metrics
    return ResultHelper.success(
      new Bond({
        ...this._props,
        faceValue: convertedFaceValueResult.value,
        analyticalCurrency: targetCurrency,
        metrics: undefined,
      })
    );
  }
}
