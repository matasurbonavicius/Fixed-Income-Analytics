import type { Result } from "@domain/shared";

/**
 * Unwrap a `Result<T>`, throwing with the contained error if it failed.
 * Keeps test setup terse — every value-object factory returns a Result.
 */
export function unwrap<T>(result: Result<T>): T {
  if (!result.success) {
    throw new Error(`Expected success but got failure: ${result.error}`);
  }
  return result.value;
}
