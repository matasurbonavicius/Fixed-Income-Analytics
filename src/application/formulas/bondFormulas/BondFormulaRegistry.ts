import { BondFormula } from "./BondFormula";
import { AccruedInterestFormula } from "./formulas";
import { CashFlowsFormula } from "./formulas";
import { CleanPriceFormula } from "./formulas";
import { DirtyPriceFormula } from "./formulas";
import { DurationFormula } from "./formulas";
import { DiscountRateFormula } from "./formulas";

export const ALL_BOND_FORMULAS: BondFormula[] = [
  new DiscountRateFormula(),  
  new AccruedInterestFormula(),
  new CashFlowsFormula(),
  new CleanPriceFormula(),    
  new DirtyPriceFormula(),
  new DurationFormula(),
];

/**
 * Get formula by ID
 */
export function getBondFormulaById(id: string): BondFormula | undefined {
  return ALL_BOND_FORMULAS.find((f) => f.id === id);
}

/**
 * Get all formula IDs
 */
export function getAllBondFormulaIds(): string[] {
  return ALL_BOND_FORMULAS.map((f) => f.id);
}