import { Bond } from "@domain/entities";
import { MarketData, MarketDataStore } from "@domain/dataStructures";
import { BondFormulaOptions } from "@domain/specifications";
import { Result, ResultHelper } from "@domain/shared";
import { BondCalculationService } from "./BondCalculationService";
import { pickLocale } from "@domain/i18n";

export interface BondCalculationResult {
  bondId: string;
  bondName: string;
  success: boolean;
  bond?: Bond;
  error?: string;
}

export interface DateCalculationResult {
  asOfDate: string;
  results: BondCalculationResult[];
  stats: {
    total: number;
    success: number;
    failed: number;
  };
}

export interface BondsCalculationResult {
  dateResults: DateCalculationResult[];
  stats: {
    totalCalculations: number;
    successfulCalculations: number;
    failedCalculations: number;
    totalDates: number;
    totalBonds: number;
  };
  errors: Array<{
    bondId: string;
    bondName: string;
    date: string;
    error: string;
  }>;
}

export interface BondsCalculationOptions {
  includeInitialOutflow?: boolean;
  onDateProgress?: (
    dateIndex: number,
    totalDates: number,
    asOfDate: string
  ) => void;
  onBondProgress?: (
    bondIndex: number,
    totalBonds: number,
    bondName: string
  ) => void;
}

export class BondsCalculationService {
  //Calculate metrics for multiple bonds on a s2ingle date
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
      // bond.props.name is LocalizedInput — resolve to a plain string for
      // progress reporting (no UI locale here; fall back to any populated
      // language). The calc engine itself never reads this field.
      const bondName =
        pickLocale(bond.props.name, undefined, { fallbackToAny: true }) || bondId;

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
