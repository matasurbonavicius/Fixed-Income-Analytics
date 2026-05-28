import { MarketData } from "./MarketData";
import { Result, ResultHelper } from "@domain/shared";
import { UTCDate} from "@domain/valueObjects";

export interface MarketDataStoreProps {
  historicalData: Map<string, MarketData>;  // date string -> MarketData
}

export class MarketDataStore {
  private readonly _props: MarketDataStoreProps;

  private constructor(props: MarketDataStoreProps) {
    this._props = { ...props };
  }

  static create(marketDataPoints: MarketData[] = []): MarketDataStore {
    const historicalData = new Map<string, MarketData>();
    marketDataPoints.forEach(data => {
      historicalData.set(data.asOfDate.toISOString(), data);
    });
    return new MarketDataStore({ historicalData });
  }

  get props(): Readonly<MarketDataStoreProps> {
    return this._props;
  }

  // ============= GETTERS =============
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

  getLatest(): Result<MarketData> {
    if (this._props.historicalData.size === 0) {
      return ResultHelper.failure("No market data available");
    }

    const sorted = Array.from(this._props.historicalData.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));

    return ResultHelper.success(sorted[0][1]);
  }

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
  addMarketData(marketData: MarketData): MarketDataStore {
    const newHistoricalData = new Map(this._props.historicalData);
    newHistoricalData.set(marketData.asOfDate.toISOString(), marketData);
    return new MarketDataStore({ historicalData: newHistoricalData });
  }
}