import { Bond } from "@domain/entities";
import { MarketData, MarketDataStore } from "@domain/dataStructures";
import { BondFormulaOptions } from "@domain/specifications";
import { Result, ResultHelper } from "@domain/shared";
import { BondCalculationService } from "./BondCalculationService";

/**
 * Per-bond outcome within a single date's batch run.
 *
 * @remarks
 * Unlike a {@link Result}, this is a flattened, serialization-friendly record:
 * one bond's failure does not abort the batch, so `success` is carried as a
 * field and `bond`/`error` are populated according to it.
 *
 * @category Results & Types
 */
export interface BondCalculationResult {
  /** Primary identifier of the bond this row reports on. */
  bondId: string;
  /** Human-readable bond name, falling back to the id when unnamed. */
  bondName: string;
  /** Whether this bond's calculation succeeded. */
  success: boolean;
  /** The metrics-laden {@link Bond}; present only when `success` is `true`. */
  bond?: Bond;
  /** Failure message; present only when `success` is `false`. */
  error?: string;
}

/**
 * Results for every bond computed against one market-data date.
 *
 * @category Results & Types
 */
export interface DateCalculationResult {
  /** The as-of date these results belong to, as an ISO `YYYY-MM-DD` string. */
  asOfDate: string;
  /** One {@link BondCalculationResult} per bond, in input order. */
  results: BondCalculationResult[];
  /** Roll-up counts for this date. */
  stats: {
    /** Number of bonds attempted. */
    total: number;
    /** Number of bonds that succeeded. */
    success: number;
    /** Number of bonds that failed - `total - success`. */
    failed: number;
  };
}

/**
 * Aggregated outcome of a multi-date batch run across all bonds and dates.
 *
 * @category Results & Types
 */
export interface BondsCalculationResult {
  /** Per-date breakdowns, ordered newest date first. */
  dateResults: DateCalculationResult[];
  /** Roll-up counts spanning the whole `bonds × dates` grid. */
  stats: {
    /** Total bond-date computations attempted - `totalBonds * totalDates`. */
    totalCalculations: number;
    /** Number of bond-date computations that succeeded. */
    successfulCalculations: number;
    /** Number that failed - `totalCalculations - successfulCalculations`. */
    failedCalculations: number;
    /** Number of distinct dates processed. */
    totalDates: number;
    /** Number of bonds processed per date. */
    totalBonds: number;
  };
  /** Flat list of every individual failure, tagged with bond and date. */
  errors: Array<{
    /** Primary identifier of the failed bond. */
    bondId: string;
    /** Name of the failed bond. */
    bondName: string;
    /** The as-of date on which the failure occurred (`YYYY-MM-DD`). */
    date: string;
    /** The failure message. */
    error: string;
  }>;
}

/**
 * Tuning and progress-reporting options for a batch run.
 *
 * @category Results & Types
 */
export interface BondsCalculationOptions {
  /**
   * Whether each bond's cash-flow schedule begins with the purchase outflow
   * (the price paid at settlement). Defaults to `true`.
   */
  includeInitialOutflow?: boolean;
  /**
   * Invoked once per date as a multi-date run advances. Useful for driving a
   * progress bar.
   *
   * @param dateIndex - 1-based index of the date being processed.
   * @param totalDates - Total number of dates in the run.
   * @param asOfDate - The date being processed (`YYYY-MM-DD`).
   */
  onDateProgress?: (
    dateIndex: number,
    totalDates: number,
    asOfDate: string
  ) => void;
  /**
   * Invoked once per bond as a date's bonds are dispatched.
   *
   * @param bondIndex - 1-based index of the bond being processed.
   * @param totalBonds - Total number of bonds for the date.
   * @param bondName - Name of the bond being processed.
   */
  onBondProgress?: (
    bondIndex: number,
    totalBonds: number,
    bondName: string
  ) => void;
}

/**
 * Computes analytics for many {@link Bond}s, optionally across many dates.
 *
 * A thin batch wrapper over {@link BondCalculationService}: it builds the
 * per-date {@link BondFormulaOptions}, runs each bond's calculation
 * concurrently, and collects the outcomes. Crucially it is **fault-tolerant** -
 * a single bond's failure is recorded rather than aborting the batch - so the
 * returned structures use plain `success` flags and an `errors` list instead of
 * short-circuiting like a single {@link Result} would.
 *
 * @remarks
 * Use this when valuing a list of bonds; for a single bond use
 * {@link BondCalculationService}, and for portfolio-level aggregation use
 * {@link PortfolioCalculationService}.
 *
 * @category Services
 */
export class BondsCalculationService {
  /**
   * Values every bond against one market-data snapshot, bonds running
   * concurrently.
   *
   * Builds a single-date {@link MarketDataStore} and {@link BondFormulaOptions}
   * from `marketData`, then dispatches {@link BondCalculationService.calculate}
   * for every bond at once. A failing bond does not abort the others; its
   * failure is captured as a {@link BondCalculationResult} with `success: false`.
   * The outer {@link Result} fails only on a structural problem, not on
   * individual bond failures.
   *
   * @param bonds - The bonds to value.
   * @param marketData - The single-date market snapshot; its `asOfDate` becomes
   *   both the settlement and analysis date.
   * @param options - Cash-flow tuning and the `onBondProgress` callback (see
   *   {@link BondsCalculationOptions}).
   * @returns A {@link Result} wrapping a {@link DateCalculationResult} with one
   *   row per bond and success/failure counts.
   */
  static async calculateForDate(
    bonds: Bond[],
    marketData: MarketData,
    options: BondsCalculationOptions = {}
  ): Promise<Result<DateCalculationResult>> {
    const asOfDate = marketData.asOfDate.toISOString().split("T")[0];
    const marketDataStore = MarketDataStore.create([marketData]);

    const formulaOptions = new BondFormulaOptions({
      settlementDate: marketData.asOfDate,
      analysisDate: marketData.asOfDate,
      cashFlow: {
        includeInitialOutflow: options.includeInitialOutflow ?? true,
      },
    });

    // Trigger all bond calculations concurrently
    const calculations = bonds.map(async (bond, i) => {
      const bondId = bond.props.id.primary;
      const bondName = bond.props.name || bondId;

      // Notify progress
      options.onBondProgress?.(i + 1, bonds.length, bondName);

      const calcResult = await BondCalculationService.calculate(
        bond,
        marketDataStore,
        formulaOptions
      );

      if (calcResult.success) {
        return {
          success: true,
          bondId,
          bondName,
          bond: calcResult.value.updatedBond,
        };
      } else {
        return {
          success: false,
          bondId,
          bondName,
          error: calcResult.error,
        };
      }
    });

    // Wait for all bond calculations to complete
    const results = await Promise.all(calculations);

    const successCount = results.filter((r) => r.success).length;

    return ResultHelper.success({
      asOfDate,
      results,
      stats: {
        total: bonds.length,
        success: successCount,
        failed: bonds.length - successCount,
      },
    });
  }

  /**
   * Values every bond at every supplied date and aggregates the results.
   *
   * Dates are processed sequentially (newest first) so progress can be
   * reported in a stable order, while bonds within each date run concurrently
   * via {@link calculateForDate}. Per-bond failures are gathered into the
   * returned `errors` list rather than aborting the run; the outer
   * {@link Result} fails only on a structural problem - for example a date key
   * present in `marketDataByDate` whose value is missing.
   *
   * @param bonds - The bonds to value at each date.
   * @param marketDataByDate - Market snapshots keyed by `YYYY-MM-DD` date
   *   string. Keys are sorted descending to determine processing order.
   * @param options - Cash-flow tuning and the `onDateProgress` /
   *   `onBondProgress` callbacks (see {@link BondsCalculationOptions}).
   * @returns A {@link Result} wrapping a {@link BondsCalculationResult} with the
   *   per-date breakdowns, grid-wide counts, and a flat list of failures.
   */
  // Calculate metrics for multiple bonds across multiple dates
  static async calculateForAllDates(
    bonds: Bond[],
    marketDataByDate: Map<string, MarketData>,
    options: BondsCalculationOptions = {}
  ): Promise<Result<BondsCalculationResult>> {
    const dateResults: DateCalculationResult[] = [];
    const errors: BondsCalculationResult["errors"] = [];

    // Sort dates newest first
    const sortedDates = Array.from(marketDataByDate.keys()).sort((a, b) =>
      b.localeCompare(a)
    );
    const totalDates = sortedDates.length;
    const totalBonds = bonds.length;

    // Process each date sequentially (for progress tracking)
    for (let dateIndex = 0; dateIndex < sortedDates.length; dateIndex++) {
      const dateStr = sortedDates[dateIndex];
      const marketData = marketDataByDate.get(dateStr);

      if (!marketData) {
        return ResultHelper.failure(`No market data found for date ${dateStr}`);
      }

      options.onDateProgress?.(dateIndex + 1, totalDates, dateStr);

      // Calculate for this date (bonds run concurrently)
      const dateResult = await this.calculateForDate(
        bonds,
        marketData,
        options
      );

      if (!dateResult.success) {
        return ResultHelper.addContext(
          dateResult,
          `Bonds Calculation Service for date ${dateStr}`
        );
      }

      dateResults.push(dateResult.value);

      for (const result of dateResult.value.results) {
        if (!result.success && result.error) {
          errors.push({
            bondId: result.bondId,
            bondName: result.bondName,
            date: dateStr,
            error: result.error,
          });
        }
      }
    }

    const totalCalculations = totalDates * totalBonds;
    const successfulCalculations = dateResults.reduce(
      (sum, dr) => sum + dr.stats.success,
      0
    );
    const failedCalculations = totalCalculations - successfulCalculations;

    return ResultHelper.success({
      dateResults,
      stats: {
        totalCalculations,
        successfulCalculations,
        failedCalculations,
        totalDates,
        totalBonds,
      },
      errors,
    });
  }
}
