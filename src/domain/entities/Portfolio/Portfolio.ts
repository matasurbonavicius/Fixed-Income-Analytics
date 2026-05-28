import { PortfolioProps } from "./Portfolio.types";

export class Portfolio {
  private readonly _props: PortfolioProps;

  private constructor(props: PortfolioProps) {
    this._props = { ...props };
  }

  static create(props: PortfolioProps): Portfolio {
    return new Portfolio(props);
  }

  get props(): Readonly<PortfolioProps> {
    return this._props;
  }

  // ============= SINGLE UPDATER =============
  update(updates: Partial<PortfolioProps>): Portfolio {
    return new Portfolio({ ...this._props, ...updates });
  }

  // ============= DELETE ALL METRICS =============
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
