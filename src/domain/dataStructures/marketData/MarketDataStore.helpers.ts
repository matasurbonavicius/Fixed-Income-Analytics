import { MarketData, YieldCurve, InternalRatingSpread } from "./";
import {
  Currency,
  CreditRating,
  DiscountCurve,
  CurveInterpolation,
} from "@domain/valueObjects";
import { Result, ResultHelper } from "@domain/shared";

const TENOR_TOLERANCE = 0.01; // years

/**
 * Get yield curve from market data matching currency
 */
/**
 * @category Market Data
 */
export function getYieldCurve(
  marketData: MarketData,
  currency: Currency
): Result<YieldCurve> {
  if (!marketData.yieldCurve || marketData.yieldCurve.length === 0) {
    return ResultHelper.failure("No yield curves available in market data");
  }

  const curve = marketData.yieldCurve.find(
    (yc) => yc.currency.equals(currency)
  );

  if (!curve) {
    return ResultHelper.failure(
      `No yield curve found for ${currency.code}`
    );
  }

  return ResultHelper.success(curve);
}

/**
 * Build an immutable {@link DiscountCurve} from the market-data yield curve for
 * a currency.
 *
 * Finds the {@link YieldCurve} for `currency` (via {@link getYieldCurve}) and
 * turns its `{ tenor, rate }` pillars into a queryable curve that discounts off
 * `DF(t)`. This is the curve object the opt-in curve-pricing and Z-spread paths
 * consume; the raw `YieldCurve` is just data.
 *
 * @param marketData - The snapshot to read the yield curve from.
 * @param currency - The currency whose curve to build.
 * @param interpolation - Interpolation method; defaults to the curve's own
 *   default ({@link CurveInterpolation.LOG_LINEAR_DF}).
 * @returns A {@link Result} with the built {@link DiscountCurve}, or a failure
 *   when no curve exists for the currency or its pillars are invalid.
 *
 * @category Market Data
 */
export function buildDiscountCurve(
  marketData: MarketData,
  currency: Currency,
  interpolation?: CurveInterpolation
): Result<DiscountCurve> {
  const curveResult = getYieldCurve(marketData, currency);
  if (!curveResult.success) {
    return curveResult;
  }

  return DiscountCurve.fromZeroRates(curveResult.value.points, {
    interpolation,
  });
}

/**
 * Interpolate yield curve to get rate at specific tenor
 * Uses linear interpolation between points
 */
/**
 * @category Market Data
 */
export function interpolateYieldCurve(
  curve: YieldCurve,
  targetTenor: number
): Result<number> {
  if (!curve.points || curve.points.length === 0) {
    return ResultHelper.failure("Yield curve has no points");
  }

  if (targetTenor < 0) {
    return ResultHelper.failure("Target tenor cannot be negative");
  }

  // Sort points by tenor
  const sortedPoints = [...curve.points].sort((a, b) => a.tenor - b.tenor);

  // Check for exact match (within tolerance)
  const exactMatch = sortedPoints.find(
    (point) => Math.abs(point.tenor - targetTenor) < TENOR_TOLERANCE
  );
  if (exactMatch) {
    return ResultHelper.success(exactMatch.rate.asDecimal);
  }

  // Extrapolate if before first point
  if (targetTenor < sortedPoints[0].tenor) {
    return ResultHelper.success(sortedPoints[0].rate.asDecimal);
  }

  // Extrapolate if after last point
  if (targetTenor > sortedPoints[sortedPoints.length - 1].tenor) {
    return ResultHelper.success(
      sortedPoints[sortedPoints.length - 1].rate.asDecimal
    );
  }

  // Find surrounding points for interpolation
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const lowerPoint = sortedPoints[i];
    const upperPoint = sortedPoints[i + 1];

    if (targetTenor >= lowerPoint.tenor && targetTenor <= upperPoint.tenor) {
      // Linear interpolation
      const t =
        (targetTenor - lowerPoint.tenor) /
        (upperPoint.tenor - lowerPoint.tenor);
      const interpolatedRate =
        lowerPoint.rate.asDecimal +
        t * (upperPoint.rate.asDecimal - lowerPoint.rate.asDecimal);

      return ResultHelper.success(interpolatedRate);
    }
  }

  return ResultHelper.failure("Unable to interpolate yield curve");
}

/**
 * Get credit spread from market data matching rating and currency
 * Credit spread is simply a flat spread by rating (no tenor dimension)
 */
/**
 * @category Market Data
 */
export function getCreditSpread(
  marketData: MarketData,
  rating: CreditRating,
  currency: Currency,
): Result<number> {
  // If no credit spread data available
  if (!marketData.creditSpread || marketData.creditSpread.length === 0) {
    return ResultHelper.failure("No credit spread data available");
  }

  // Find spread matching rating and currency
  const matchingSpread = marketData.creditSpread.find(
    (cs) =>
      cs.rating.equals(rating) &&
      cs.currency.equals(currency)
  );

  if (!matchingSpread) {
    return ResultHelper.failure(
      `No credit spread found for rating ${rating.toString()}, currency ${currency.code}`
    );
  }

  return ResultHelper.success(matchingSpread.spread);
}

/**
 * Get internal rating spread from market data by rating ID
 */
/**
 * @category Market Data
 */
export function getInternalRatingSpread(
  marketData: MarketData,
  internalRatingId: string
): Result<InternalRatingSpread> {
  if (!marketData.internalRatingSpread || marketData.internalRatingSpread.length === 0) {
    return ResultHelper.failure("No internal rating spread data available");
  }

  const matchingRating = marketData.internalRatingSpread.find(
    (irs) => irs.id === internalRatingId
  );

  if (!matchingRating) {
    return ResultHelper.failure(
      `No internal rating spread found for ID ${internalRatingId}`
    );
  }

  return ResultHelper.success(matchingRating);
}