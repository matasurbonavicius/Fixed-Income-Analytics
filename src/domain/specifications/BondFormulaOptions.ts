import {
  CashFlowOptions,
  DiscountRateOptions,
} from "@domain/formulas";
import {UTCDate} from "@domain/valueObjects";

// ble gal cia reikia nurodyti kad is diskonto normos skaiciuojam dirty ar clean kainaas

interface BondFormulaOptionsInput {
  settlementDate: UTCDate;
  analysisDate: UTCDate;
  discountRate?: DiscountRateOptions;
  cashFlow?: CashFlowOptions;
}

export class BondFormulaOptions {
  settlementDate: UTCDate;
  analysisDate: UTCDate;
  discountRate?: DiscountRateOptions;
  cashFlow?: CashFlowOptions;

  constructor(options: BondFormulaOptionsInput) {
    this.settlementDate = options.settlementDate;
    this.analysisDate = options.analysisDate;
    this.discountRate = options.discountRate;
    this.cashFlow = options.cashFlow;
  }
}
