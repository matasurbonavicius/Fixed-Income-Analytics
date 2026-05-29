import { PortfolioCashFlowInput } from "./CashFlows.types";
import { validatePositions } from "@domain/formulas";
import { Result, ResultHelper } from "@domain/shared";

/** @internal */
export function validatePortfolioCashFlows(
  input: PortfolioCashFlowInput
): Result<undefined> {
  const errors: string[] = [];

  errors.push(...validatePositions(input.positions, input.baseCurrency));

  for (const position of input.positions) {
    if (input.settlementDate >= position.bond.props.maturityDate) {
      errors.push(`Bond ${position.bond.props.id.primary} is matured`);
    }
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
