import { Result, ResultHelper } from "@domain/shared";
import { BootstrapInput } from "./Bootstrap.types";

/**
 * Validate the bootstrap input before solving: at least one instrument, every
 * tenor finite and positive, every par-bond frequency a positive integer and
 * every coupon rate finite, and no two instruments sharing a tenor (two quotes
 * at the same pillar are contradictory).
 *
 * @internal
 */
export function validateBootstrap(input: BootstrapInput): Result<undefined> {
  const errors: string[] = [];

  if (!input.instruments || input.instruments.length === 0) {
    errors.push("Bootstrap requires at least one instrument");
  }

  const seenTenors: number[] = [];
  for (const inst of input.instruments ?? []) {
    if (!Number.isFinite(inst.tenor) || inst.tenor <= 0) {
      errors.push(
        `Instrument tenor must be finite and positive, got ${inst.tenor}`
      );
      continue;
    }

    if (seenTenors.some((t) => Math.abs(t - inst.tenor) < 1e-9)) {
      errors.push(`Duplicate instrument tenor ${inst.tenor}`);
    }
    seenTenors.push(inst.tenor);

    if (inst.kind === "ZERO_RATE") {
      if (!Number.isFinite(inst.rate.asDecimal)) {
        errors.push(`Zero rate at ${inst.tenor} must be finite`);
      }
    } else {
      if (!Number.isFinite(inst.couponRate.asDecimal)) {
        errors.push(`Coupon rate at ${inst.tenor} must be finite`);
      }
      if (!Number.isInteger(inst.frequency) || inst.frequency < 1) {
        errors.push(
          `Par bond frequency at ${inst.tenor} must be a positive integer, got ${inst.frequency}`
        );
      }
    }
  }

  if (errors.length > 0) {
    return ResultHelper.failure(errors.join("; "));
  }

  return ResultHelper.success(undefined);
}
