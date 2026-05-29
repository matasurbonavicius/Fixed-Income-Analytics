import {
  Money,
  Currency,
  Percentage,
  CreditRating,
  BondId,
  UTCDate,
} from "@domain/valueObjects";
import {
  BondCategory,
  IssuerSector,
  BusinessDayConvention,
  CountryCode,
  DiscountRateMethod
} from "./Bond.enums";
import { BondMetrics } from "./Bond.metrics";
import { CalendarCode } from "@calendars";
import { DayCountConvention } from "@domain/formulas";

// News link for bond-related articles.
/**
 * @internal
 */
export interface NewsLink {
  url: string;
  title?: string;
  addedAt: UTCDate;
}

// Issuer details.
/**
 * @internal
 */
export interface IssuerDetails {
  description?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
}

interface BaseBondProps {
  // === IDENTIFIER ===
  id: BondId;

  // === BASIC INFO ===
  // Display text. The calculation engine never reads these fields.
  name: string;
  description?: string;

  // === ISSUER INFO ===
  issueDate: UTCDate; // Required. No good way to know otherwise
  issuer?: string; // Company display name (issuer codes use issuerCountry / issuerSector)
  issuerCountry?: CountryCode;

  // === CATEGORIZATION ===
  bondCategory?: BondCategory;
  issuerSector?: IssuerSector;

  // === CURRENCIES ===
  issueCurrency: Currency;
  analyticalCurrency: Currency; // If not provided, defaults to issueCurrency

  // === CORE TERMS ===
  faceValue: Money;
  maturityDate: UTCDate;

  // Issue price, must add

  // === TRADING INFO ===
  settlementDays: number;                    
  dayCountConvention: DayCountConvention;         
  businessDayConvention: BusinessDayConvention;  
  paymentCalendar: CalendarCode;                

  // === CREDIT INFO ===
  creditRating?: CreditRating;

  // === NEWS ===
  newsLinks?: NewsLink[];

  // === ISSUER DETAILS ===
  issuerDetails?: IssuerDetails;

  // === TAGS ===
  tags?: readonly string[];

  // === VALUATION OVERRIDES ===
  internalRatingId?: string;         // UUID of internal rating
  manualSpreadBps?: number;          // Manual spread override in basis points
  manualDiscountRate?: Percentage;   // Direct discount rate override <<< we mush also say whether this is based on clean or dirty price
  valuationMethodOverride?: DiscountRateMethod[]; // A list of methods to use for valuation, in order of priority

  // === METRICS ===
  metrics?: BondMetrics;
}

// ============= FIXED RATE BOND =============
/**
 * @category Bond Types & Shapes
 */
export interface FixedRateBondProps extends BaseBondProps {
  bondType: "FIXED";
  fixedRate: Percentage;  // Required for fixed rate bonds
  frequency: number;      // Payments per year
  firstCouponDate?: UTCDate; // To handle long-first coupon. Default is short-first coupon
}

// ============= ZERO COUPON BOND =============
/**
 * @category Bond Types & Shapes
 */
export interface ZeroCouponBondProps extends BaseBondProps {
  bondType: "ZERO";
  frequency: 0; // Always 0 for zero coupon
}

// ============= DISCRIMINATED UNION =============
/**
 * @category Bond Types & Shapes
 */
export type BondProps = FixedRateBondProps | ZeroCouponBondProps;
