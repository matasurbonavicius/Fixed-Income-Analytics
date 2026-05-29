import { Result, ResultHelper } from "@domain/shared";

/**
 * An immutable, validated identity for a bond.
 *
 * A bond may be known by several identifiers - an ISIN, a CUSIP, or some
 * internal/primary key - and different data sources lead with different ones.
 * `BondId` captures all of them while designating a single {@link primary}
 * identifier for stable equality and display, so the rest of the system can
 * key on one value yet still recognize the instrument under any of its codes
 * (see {@link matches}). It guarantees at least one identifier is present, so
 * an "identity-less" bond can never exist.
 *
 * @example
 * ```ts
 * const id = BondId.create({ isin: "US0378331005" }).value;
 * id.primary;                  // "US0378331005" (ISIN used as the primary)
 * id.matches("US0378331005");  // true
 * ```
 *
 * @category Value Objects
 */
export class BondId {
  constructor(
    private readonly _primary: string,
    private readonly _isin?: string,
    private readonly _cusip?: string
  ) {}

  /**
   * Creates a {@link BondId} from any combination of identifiers.
   *
   * The {@link primary} key is chosen in priority order - explicit `primary`,
   * then `isin`, then `cusip` - and at least one (after trimming) must be
   * present, otherwise creation fails.
   *
   * @param data - The available identifiers.
   * @param data.primary - An explicit primary key, if any.
   * @param data.isin - The ISIN, if known.
   * @param data.cusip - The CUSIP, if known.
   * @returns The {@link BondId}, or a failure when no identifier is supplied.
   *   Never throws.
   */
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

  /** The designated primary identifier; always present. */
  get primary(): string {
    return this._primary;
  }

  /** The ISIN, if one was supplied. */
  get isin(): string | undefined {
    return this._isin;
  }

  /** The CUSIP, if one was supplied. */
  get cusip(): string | undefined {
    return this._cusip;
  }

  /**
   * Tests whether a raw identifier string refers to this bond.
   *
   * Matches against the primary, ISIN, or CUSIP, so a bond can be located by
   * whichever code a caller happens to hold.
   *
   * @param otherId - The identifier string to test.
   * @returns `true` if it equals any of this bond's identifiers.
   */
  matches(otherId: string): boolean {
    return (
      this._primary === otherId ||
      this._isin === otherId ||
      this._cusip === otherId
    );
  }

  /**
   * Tests whether two {@link BondId}s denote the same bond.
   *
   * They are considered equal if their primary keys match, or if they share a
   * defined ISIN, or a defined CUSIP - so two ids sourced differently but
   * pointing at the same instrument are recognized as one.
   *
   * @param other - The {@link BondId} to compare against.
   * @returns `true` when they identify the same bond.
   */
  equals(other: BondId): boolean {
    return (
      this._primary === other._primary ||
      (this._isin !== undefined && this._isin === other._isin) ||
      (this._cusip !== undefined && this._cusip === other._cusip)
    );
  }
}
