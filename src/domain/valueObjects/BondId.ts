import { Result, ResultHelper } from "@domain/shared";

export class BondId {
  constructor(
    private readonly _primary: string,
    private readonly _isin?: string,
    private readonly _cusip?: string
  ) {}

  static create(data: {
    primary?: string;
    isin?: string;
    cusip?: string;
  }): Result<BondId> {
    // Determine which identifier to use as primary
    const primaryId =
      data.primary?.trim() || data.isin?.trim() || data.cusip?.trim();

    if (!primaryId) {
      return ResultHelper.failure(
        "At least one identifier (primary, ISIN, or CUSIP) is required"
      );
    }

    return ResultHelper.success(new BondId(primaryId, data.isin, data.cusip));
  }

  get primary(): string {
    return this._primary;
  }

  get isin(): string | undefined {
    return this._isin;
  }

  get cusip(): string | undefined {
    return this._cusip;
  }

  matches(otherId: string): boolean {
    return (
      this._primary === otherId ||
      this._isin === otherId ||
      this._cusip === otherId
    );
  }

  equals(other: BondId): boolean {
    return (
      this._primary === other._primary ||
      (this._isin !== undefined && this._isin === other._isin) ||
      (this._cusip !== undefined && this._cusip === other._cusip)
    );
  }
}
