import { PortfolioProps } from "./Portfolio.types";

/**
 * A holding of bond positions valued together in a single base currency.
 *
 * A `Portfolio` is essentially a named set of `{ bond, quantity }` positions
 * (see {@link PortfolioProps}) plus a base {@link Currency} that aggregate
 * metrics - total market value, weighted duration, combined cash flows - are
 * expressed in. Like {@link Bond}, it holds an optional computed-analytics slot
 * (`PortfolioMetrics`) but performs no math itself; the calculation pipeline
 * populates it.
 *
 * The entity is **immutable**: {@link update} and {@link deleteAllMetrics}
 * return a new `Portfolio` instead of mutating in place.
 *
 * @example
 * ```ts
 * const portfolio = Portfolio.create({ id, name, positions, baseCurrency });
 * const priced = portfolio.update({ metrics });   // attach aggregate analytics
 * ```
 *
 * @category Entities
 */
export class Portfolio {
  private readonly _props: PortfolioProps;

  private constructor(props: PortfolioProps) {
    this._props = { ...props };
  }

  /**
   * Creates a `Portfolio` from its positions and base currency.
   *
   * @param props - The {@link PortfolioProps}: id, name, positions, base
   *   currency, and optional metrics.
   * @returns The constructed {@link Portfolio}.
   */
  static create(props: PortfolioProps): Portfolio {
    return new Portfolio(props);
  }

  /** The portfolio's positions and analytics ({@link PortfolioProps}), read-only. */
  get props(): Readonly<PortfolioProps> {
    return this._props;
  }

  // ============= SINGLE UPDATER =============
  /**
   * Returns a copy of the portfolio with the given fields overridden.
   *
   * Typically used to attach freshly computed aggregate metrics. The original
   * portfolio is left unchanged.
   *
   * @param updates - Partial {@link PortfolioProps} to merge over the current
   *   ones.
   * @returns A new {@link Portfolio} with the merged props.
   */
  update(updates: Partial<PortfolioProps>): Portfolio {
    return new Portfolio({ ...this._props, ...updates });
  }

  // ============= DELETE ALL METRICS =============
  /**
   * Returns a copy with all computed analytics cleared - both the portfolio's
   * own aggregate metrics and the {@link BondMetrics} on every held
   * {@link Bond}.
   *
   * Use this to invalidate a whole portfolio's analytics in one step (e.g.
   * before recalculating), ensuring no stale per-bond metrics linger inside the
   * positions.
   *
   * @returns A new {@link Portfolio} with no metrics anywhere in its positions.
   */
  deleteAllMetrics(): Portfolio {
    // Remove portfolio metrics and delete metrics from all bonds
    const { metrics: _metrics, ...propsWithoutMetrics } = this._props;

    // Map through positions and delete metrics from each bond
    const positionsWithoutMetrics = propsWithoutMetrics.positions.map(
      (position) => ({
        ...position,
        bond: position.bond.deleteMetrics(),
      })
    );

    return new Portfolio({
      ...propsWithoutMetrics,
      positions: positionsWithoutMetrics,
    });
  }
}
