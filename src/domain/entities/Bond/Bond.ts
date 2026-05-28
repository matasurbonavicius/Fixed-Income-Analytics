import { BondProps } from "./Bond.types";
import { Currency } from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

export class Bond {
  private readonly _props: BondProps;

  private constructor(props: BondProps) {
    this._props = { ...props };
  }

  static create(props: BondProps): Bond {
    const bondProps = {
      ...props,
      // Adding some defaults during the creation phase
      analyticalCurrency: props.analyticalCurrency ?? props.issueCurrency,
    };
    return new Bond(bondProps);
  }

  get props(): Readonly<BondProps> {
    return this._props;
  }

  update<T extends BondProps>(updates: Partial<T>): Bond {
    return new Bond({ ...this._props, ...updates } as BondProps);
  }

  deleteMetrics(): Bond {
    const { metrics: _metrics, ...propsWithoutMetrics } = this._props;
    return new Bond(propsWithoutMetrics as BondProps);
  }

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
