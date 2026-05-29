/** @internal */
export function validateFrequency(frequency: number): string[] {
  const validFrequencies = [1, 2, 3, 4, 6, 12];
  if (!validFrequencies.includes(frequency)) {
    return ["Frequency must be 1, 2, 3, 4, 6, or 12 (payments per year)"];
  }
  return [];
}