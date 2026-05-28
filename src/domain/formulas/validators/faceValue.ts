import { Money } from "@domain/valueObjects";

export function validateFaceValue(faceValue: Money): string[] {
  const errors: string[] = [];

  if (faceValue.isZero()) {
    errors.push("Face value cannot be zero");
  }

  if (faceValue.isNegative()) {
    errors.push("Face value must be positive");
  }

  const MIN_FACE_VALUE = 100;

  if (faceValue.amount < MIN_FACE_VALUE) {
    errors.push(
      `Face value must be at least ${faceValue.currency.symbol}${MIN_FACE_VALUE}`
    );
  }

  return errors;
}