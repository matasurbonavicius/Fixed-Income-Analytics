import { Result, ResultHelper } from "@domain/shared";

export interface CreditRatings {
  SP: string;
  MOODYS: string;
  FITCH: string;
  Characteristic: string;
}

export class CreditRating {
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
   * Create a CreditRating from its numeric code (0-21)
   */
  static fromNumeric(code: number): CreditRating | undefined {
    if (code < 0 || code > 21 || !Number.isInteger(code)) {
      return undefined;
    }
    return new CreditRating(code);
  }
  get code(): number {
    return this._code;
  }

  get sp(): string {
    return CreditRating.RATINGS[this._code]?.SP || "NR";
  }

  get moodys(): string {
    return CreditRating.RATINGS[this._code]?.MOODYS || "NR";
  }

  get fitch(): string {
    return CreditRating.RATINGS[this._code]?.FITCH || "NR";
  }

  equals(other: CreditRating): boolean {
    return this._code === other._code;
  }

  toString(): string {
    return this.sp; // Default to S&P format
  }
}
