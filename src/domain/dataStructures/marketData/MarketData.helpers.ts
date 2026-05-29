import { Bond } from "@domain/entities";
import { MarketData } from "@domain/dataStructures";
import { Result, ResultHelper } from "@domain/shared";
import { Percentage } from "@domain/valueObjects";

/**
 * Get market price as percentage of par (mid price if ask available, otherwise bid)
 */
/**
 * @category Market Data
 */
 export function getMarketPrice(
    bond: Bond,
    marketData: MarketData,
    priceType: "clean" | "dirty"
  ): Result<Percentage> {
    const priceData = marketData.bondPrice?.find(
      (bp) => bp.bondId.equals(bond.props.id) && bp.priceType === priceType
    );

    if (!priceData) {
      return ResultHelper.failure(
        `No ${priceType.toLowerCase()} market price data found for bond ID: ${bond.props.id.toString()}`
      );
    }

    // Return mid price or just bid if ask is not there
    if (priceData.ask) {
      const midResult = priceData.bid.add(priceData.ask);
      if (!midResult.success) {
        return midResult;
      }
      return midResult.value!.multiply(0.5);
    }

    return ResultHelper.success(priceData.bid);
  }