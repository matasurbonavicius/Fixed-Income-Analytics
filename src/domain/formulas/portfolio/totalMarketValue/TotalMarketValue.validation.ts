import { TotalMarketValueInput } from "./TotalMarketValue.types";
import { validatePositions } from "@domain/formulas";
import { Result, ResultHelper } from "@domain/shared";

export function validatePortfolioTotalMarketValue(
  input: TotalMarketValueInput
): Result<undefined> {
  const errors: string[] = [];

  errors.push(...validatePositions(input.positions, input.baseCurrency));

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
