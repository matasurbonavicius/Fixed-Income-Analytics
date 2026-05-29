import { Result, ResultHelper } from "@domain/shared";

/**
 * One row of the rating-scale mapping: the equivalent grades across the three
 * major agencies plus a plain-language characterization of that grade.
 *
 * @internal
 */
export interface CreditRatings {
  /** Standard & Poor's grade, e.g. `"BBB+"`. */
  SP: string;
  /** Moody's grade, e.g. `"Baa1"`. */
  MOODYS: string;
  /** Fitch grade, e.g. `"BBB+"`. */
  FITCH: string;
  /** Human-readable grade band, e.g. `"Lower Medium Grade"`. */
  Characteristic: string;
}

/**
 * An immutable, validated agency credit rating.
 *
 * The grade is stored internally as a single ordinal code (`0` = Not Rated,
 * `1` = the highest grade, `21` = default) drawn from a canonical S&P / Moody's
 * / Fitch equivalence table. This kills two problems a raw string would carry:
 * an arbitrary or mistyped grade can never exist, and a rating quoted on any
 * one agency's scale ({@link sp}, {@link moodys}, {@link fitch}) can be read
 * back on the others without a separate conversion step.
 *
 * @example
 * ```ts
 * const r = CreditRating.create("Baa1").value; // accepts any agency's notation
 * r.sp;     // "BBB+"
 * r.fitch;  // "BBB+"
 * r.code;   // 8
 * ```
 *
 * @remarks
 * **Supported grades.** {@link create} accepts any S&P, Moody's, or Fitch
 * notation from the column below (case-insensitive); {@link fromNumeric} takes
 * the ordinal `code`. Codes are ordered best (`1`) to worst (`21`), with `0`
 * reserved for Not Rated.
 *
 * | Code | S&P | Moody's | Fitch | Characteristic |
 * |:----:|-----|---------|-------|----------------|
 * | 0 | Not Rated | Not Rated | Not Rated | Not Rated |
 * | 1 | AAA | Aaa | AAA | Prime |
 * | 2 | AA+ | Aa1 | AA+ | High Grade |
 * | 3 | AA | Aa2 | AA | High Grade |
 * | 4 | AA- | Aa3 | AA- | High Grade |
 * | 5 | A+ | A1 | A+ | Upper Medium Grade |
 * | 6 | A | A2 | A | Upper Medium Grade |
 * | 7 | A- | A3 | A- | Upper Medium Grade |
 * | 8 | BBB+ | Baa1 | BBB+ | Lower Medium Grade |
 * | 9 | BBB | Baa2 | BBB | Lower Medium Grade |
 * | 10 | BBB- | Baa3 | BBB- | Lower Medium Grade |
 * | 11 | BB+ | Ba1 | BB+ | Non-investment grade speculative |
 * | 12 | BB | Ba2 | BB | Non-investment grade speculative |
 * | 13 | BB- | Ba3 | BB- | Non-investment grade speculative |
 * | 14 | B+ | B1 | B+ | Highly Speculative |
 * | 15 | B | B2 | B | Highly Speculative |
 * | 16 | B- | B3 | B- | Highly Speculative |
 * | 17 | CCC+ | Caa1 | CCC+ | Substantial Risks |
 * | 18 | CCC | Caa2 | CCC | Extremely Speculative |
 * | 19 | CCC- | Caa3 | CCC- | Extremely Speculative |
 * | 20 | CC | Ca | CC | In default with little prospect for recovery |
 * | 21 | D | C | D | In default |
 *
 * @category Value Objects
 */
export class CreditRating {
  // NOTE: keep the class-level @remarks ratings table in sync with this map.
  private static readonly RATINGS: Record<number, CreditRatings> = {
    0: {
      SP: "Not Rated",
      MOODYS: "Not Rated",
      FITCH: "Not Rated",
      Characteristic: "Not Rated",
    },
    1: { SP: "AAA", MOODYS: "Aaa", FITCH: "AAA", Characteristic: "Prime" },
    2: { SP: "AA+", MOODYS: "Aa1", FITCH: "AA+", Characteristic: "High Grade" },
    3: { SP: "AA", MOODYS: "Aa2", FITCH: "AA", Characteristic: "High Grade" },
    4: { SP: "AA-", MOODYS: "Aa3", FITCH: "AA-", Characteristic: "High Grade" },
    5: {
      SP: "A+",
      MOODYS: "A1",
      FITCH: "A+",
      Characteristic: "Upper Medium Grade",
    },
    6: {
      SP: "A",
      MOODYS: "A2",
      FITCH: "A",
      Characteristic: "Upper Medium Grade",
    },
    7: {
      SP: "A-",
      MOODYS: "A3",
      FITCH: "A-",
      Characteristic: "Upper Medium Grade",
    },
    8: {
      SP: "BBB+",
      MOODYS: "Baa1",
      FITCH: "BBB+",
      Characteristic: "Lower Medium Grade",
    },
    9: {
      SP: "BBB",
      MOODYS: "Baa2",
      FITCH: "BBB",
      Characteristic: "Lower Medium Grade",
    },
    10: {
      SP: "BBB-",
      MOODYS: "Baa3",
      FITCH: "BBB-",
      Characteristic: "Lower Medium Grade",
    },
    11: {
      SP: "BB+",
      MOODYS: "Ba1",
      FITCH: "BB+",
      Characteristic: "Non-investment grade speculative",
    },
    12: {
      SP: "BB",
      MOODYS: "Ba2",
      FITCH: "BB",
      Characteristic: "Non-investment grade speculative",
    },
    13: {
      SP: "BB-",
      MOODYS: "Ba3",
      FITCH: "BB-",
      Characteristic: "Non-investment grade speculative",
    },
    14: {
      SP: "B+",
      MOODYS: "B1",
      FITCH: "B+",
      Characteristic: "Highly Speculative",
    },
    15: {
      SP: "B",
      MOODYS: "B2",
      FITCH: "B",
      Characteristic: "Highly Speculative",
    },
    16: {
      SP: "B-",
      MOODYS: "B3",
      FITCH: "B-",
      Characteristic: "Highly Speculative",
    },
    17: {
      SP: "CCC+",
      MOODYS: "Caa1",
      FITCH: "CCC+",
      Characteristic: "Substantial Risks",
    },
    18: {
      SP: "CCC",
      MOODYS: "Caa2",
      FITCH: "CCC",
      Characteristic: "Extremely Speculative",
    },
    19: {
      SP: "CCC-",
      MOODYS: "Caa3",
      FITCH: "CCC-",
      Characteristic: "Extremely Speculative",
    },
    20: {
      SP: "CC",
      MOODYS: "Ca",
      FITCH: "CC",
      Characteristic: "In default with little prospect for recovery",
    },
    21: { SP: "D", MOODYS: "C", FITCH: "D", Characteristic: "In default" },
  };

  constructor(private readonly _code: number) {}

  /**
   * Creates a rating from any agency's grade notation.
   *
   * The input is matched (case-insensitively, trimmed) against the S&P,
   * Moody's, and Fitch columns of the equivalence table, so `"BBB+"`, `"Baa1"`,
   * and `"bbb+"` all resolve to the same ordinal grade. An unknown grade fails.
   *
   * @param rating - An agency grade string, e.g. `"A-"`, `"Baa2"`, `"AA+"`.
   * @returns The {@link CreditRating}, or a failure for an unrecognized grade.
   *   Never throws.
   */
  static create(rating: string): Result<CreditRating> {
    // Normalise both sides: stored Moody's codes are mixed-case ("Baa2"),
    // so comparing only the input in upper-case would never match them.
    const normalized = rating.trim().toUpperCase();

    // Find the numeric code by searching through all ratings
    for (const [numericCode, ratings] of Object.entries(CreditRating.RATINGS)) {
      if (
        ratings.SP.toUpperCase() === normalized ||
        ratings.MOODYS.toUpperCase() === normalized ||
        ratings.FITCH.toUpperCase() === normalized
      ) {
        return ResultHelper.success(new CreditRating(Number(numericCode)));
      }
    }
    return ResultHelper.failure(`Unsupported credit rating: ${rating}`);
  }

  /**
   * Creates a rating directly from its ordinal code.
   *
   * The lower-level counterpart to {@link create}, useful when the numeric
   * grade is already known (e.g. round-tripping persisted data).
   *
   * @param code - The ordinal grade, an integer `0`-`21`.
   * @returns The {@link CreditRating}, or `undefined` if `code` is out of range
   *   or non-integer. (Unlike the {@link Result}-returning factories, this
   *   signals failure with `undefined`.)
   */
  static fromNumeric(code: number): CreditRating | undefined {
    if (code < 0 || code > 21 || !Number.isInteger(code)) {
      return undefined;
    }
    return new CreditRating(code);
  }
  /** The ordinal grade (`0` = Not Rated, `1` = highest, `21` = default). */
  get code(): number {
    return this._code;
  }

  /** The grade in S&P notation, e.g. `"BBB+"` (`"NR"` if unmapped). */
  get sp(): string {
    return CreditRating.RATINGS[this._code]?.SP || "NR";
  }

  /** The grade in Moody's notation, e.g. `"Baa1"` (`"NR"` if unmapped). */
  get moodys(): string {
    return CreditRating.RATINGS[this._code]?.MOODYS || "NR";
  }

  /** The grade in Fitch notation, e.g. `"BBB+"` (`"NR"` if unmapped). */
  get fitch(): string {
    return CreditRating.RATINGS[this._code]?.FITCH || "NR";
  }

  /**
   * Tests whether two ratings represent the same grade.
   *
   * Comparison is by ordinal code, so grades quoted on different agency scales
   * but equivalent (e.g. `"BBB+"` and `"Baa1"`) compare equal.
   *
   * @param other - The {@link CreditRating} to compare against.
   * @returns `true` when the grades are equivalent.
   */
  equals(other: CreditRating): boolean {
    return this._code === other._code;
  }

  /**
   * @returns The grade in S&P notation (the library's default display form).
   */
  toString(): string {
    return this.sp; // Default to S&P format
  }
}
