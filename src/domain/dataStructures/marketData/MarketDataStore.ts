import { MarketData } from "./MarketData";
import { Result, ResultHelper } from "@domain/shared";
import { UTCDate} from "@domain/valueObjects";

/**
 * Internal state of a {@link MarketDataStore}.
 *
 * @category Market Data
 */
export interface MarketDataStoreProps {
  /**
   * Snapshots keyed by their as-of date in ISO-8601 form
   * ({@link UTCDate.toISOString}). One entry per observed date; adding a
   * snapshot for an existing date replaces it.
   */
  historicalData: Map<string, MarketData>;  // date string -> MarketData
}

/**
 * A time-indexed collection of {@link MarketData} snapshots.
 *
 * Each snapshot bundles everything observed on a single as-of date - yield
 * curves, FX rates, credit spreads by rating, and quoted bond prices - and the
 * store holds a history of them keyed by date. Formulas read from it to value a
 * bond against the market view selected for a run (see
 * {@link BondFormulaOptions.analysisDate}).
 *
 * Design notes:
 *
 * - **Immutable.** {@link create} and {@link addMarketData} return new stores;
 *   the underlying map is never mutated in place.
 * - **No throwing.** Lookups that can miss return a {@link Result} describing
 *   the failure (no data for the date, empty store, or stale data) rather than
 *   throwing or returning `undefined`.
 * - **Controlled fallback.** Beyond exact-date lookup, {@link getLatest}
 *   provides the most recent snapshot and {@link getLatestWithinAge} adds a
 *   staleness guard, so callers choose how forgiving date resolution is.
 *
 * @example
 * ```ts
 * const store = MarketDataStore.create([snapshotJan, snapshotFeb]);
 * const latest = store.getLatest();           // -> Result<MarketData> (Feb)
 * const exact = store.getByDate(janDate);      // -> Result<MarketData> (Jan)
 * ```
 *
 * @category Market Data
 */
export class MarketDataStore {
  private readonly _props: MarketDataStoreProps;

  private constructor(props: MarketDataStoreProps) {
    this._props = { ...props };
  }

  /**
   * Builds a store from a list of snapshots, indexing each by its as-of date.
   *
   * If two snapshots share an as-of date the later one in the array wins, since
   * they collide on the same ISO date key.
   *
   * @param marketDataPoints - The snapshots to seed the store with. Defaults to
   *   an empty list, yielding an empty store.
   * @returns A new immutable {@link MarketDataStore}.
   */
  static create(marketDataPoints: MarketData[] = []): MarketDataStore {
    const historicalData = new Map<string, MarketData>();
    marketDataPoints.forEach(data => {
      historicalData.set(data.asOfDate.toISOString(), data);
    });
    return new MarketDataStore({ historicalData });
  }

  /** The store's internal state (date-keyed snapshot map), read-only. */
  get props(): Readonly<MarketDataStoreProps> {
    return this._props;
  }

  // ============= GETTERS =============
  /**
   * Looks up the snapshot whose as-of date matches `date` exactly.
   *
   * Matching is on the ISO-8601 date key, so the date must line up with how the
   * snapshot was stored. For tolerant resolution use {@link getLatest} or
   * {@link getLatestWithinAge}.
   *
   * @param date - The as-of date to fetch.
   * @returns A success {@link Result} with the {@link MarketData}, or a failure
   *   if no snapshot exists for that date.
   */
  getByDate(date: UTCDate): Result<MarketData> {
    const dateKey = date.toISOString();
    const data = this._props.historicalData.get(dateKey);

    if (!data) {
      return ResultHelper.failure(
        `No market data available for date ${dateKey}`
      );
    }

    return ResultHelper.success(data);
  }

  /**
   * Returns the most recent snapshot - the one with the greatest as-of date.
   *
   * Recency is decided by lexicographic comparison of the ISO-8601 date keys,
   * which orders correctly for well-formed dates.
   *
   * @returns A success {@link Result} with the latest {@link MarketData}, or a
   *   failure if the store is empty.
   */
  getLatest(): Result<MarketData> {
    if (this._props.historicalData.size === 0) {
      return ResultHelper.failure("No market data available");
    }

    const sorted = Array.from(this._props.historicalData.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));

    return ResultHelper.success(sorted[0][1]);
  }

  /**
   * Returns the latest snapshot, but only if it is fresh enough relative to
   * today.
   *
   * Fetches {@link getLatest}, computes how far its as-of date sits from the
   * current UTC date, and rejects the snapshot when that age exceeds the
   * supplied limit. Use it to guard valuations against stale market data.
   *
   * @param maxAgeMs - The maximum tolerated age of the latest snapshot before
   *   it is treated as stale.
   * @returns A success {@link Result} with the latest {@link MarketData} when
   *   it is within the age limit; a failure when the store is empty, today's
   *   date cannot be resolved, or the data is too old.
   */
  getLatestWithinAge(maxAgeMs: number): Result<MarketData> {
    const latestResult = this.getLatest();
    if (!latestResult.success) {
      return latestResult;
    }

    const latest = latestResult.value;

    const todayResult = UTCDate.today();
    if (!todayResult.success) {
      return ResultHelper.failure("Creating today's date failed")
    }
    const today = todayResult.value;
    const latestDate = latest.asOfDate
    const age = latestDate.daysUntil(today)

    if (age > maxAgeMs) {
      return ResultHelper.failure(
        `Market data is stale (${Math.round(age / 1000)}s old, max age ${Math.round(maxAgeMs / 1000)}s)`
      );
    }

    return ResultHelper.success(latest);
  }

  // ============= UPDATER =============
  /**
   * Returns a new store with the given snapshot added (or replacing any
   * snapshot already held for the same as-of date).
   *
   * The current store is left untouched, preserving immutability.
   *
   * @param marketData - The snapshot to insert, keyed by its as-of date.
   * @returns A new {@link MarketDataStore} containing the added snapshot.
   */
  addMarketData(marketData: MarketData): MarketDataStore {
    const newHistoricalData = new Map(this._props.historicalData);
    newHistoricalData.set(marketData.asOfDate.toISOString(), marketData);
    return new MarketDataStore({ historicalData: newHistoricalData });
  }
}