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
import { LocalizedTags, LocalizedInput } from "@domain/i18n";

// News link for bond-related articles. `title` is localized — same article
// can have an English headline and a Lithuanian one (or only one of them).
// LocalizedInput accepts both plain strings (legacy / single-language) and
// LocalizedString maps; consumers resolve via pickLocale.
export interface NewsLink {
  url: string;
  title?: LocalizedInput;
  addedAt: UTCDate;
}

// Issuer details. Free-text fields are localized; structured fields
// (email, phone, website) are language-neutral. `address` is localized too
// — postal addresses translate (e.g. "Vilnius, Lithuania" vs "Vilnius, Lietuva").
export interface IssuerDetails {
  description?: LocalizedInput;
  address?: LocalizedInput;
  email?: string;
  phone?: string;
  website?: string;
}

interface BaseBondProps {
  // === IDENTIFIER ===
  id: BondId;

  // === BASIC INFO ===
  // Display text — admins fill per language; UI resolves via pickLocale.
  // Calculation engine never reads these fields. Accepts either a plain
  // string (legacy / single-language consumers) or a LocalizedString map.
  name: LocalizedInput;
  description?: LocalizedInput;

  // === ISSUER INFO ===
  issueDate: UTCDate; // Required. No good way to know otherwise
  issuer?: LocalizedInput; // Company display name (issuer codes use issuerCountry / issuerSector)
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
  // Localized tag bucket — neutral tags display in every language, prefixed
  // entries (e.g. "lt:bankas") display only when that language is active.
  // See domain/i18n/LocalizedTags.ts for the storage convention.
  // Accepts the raw `text[]` array too so legacy code and demos can keep
  // passing string lists; pickTagsForLocale / flattenAllTags normalize both.
  tags?: LocalizedTags | readonly string[];

  // === VALUATION OVERRIDES ===
  internalRatingId?: string;         // UUID of internal rating
  manualSpreadBps?: number;          // Manual spread override in basis points
  manualDiscountRate?: Percentage;   // Direct discount rate override <<< we mush also say whether this is based on clean or dirty price
  valuationMethodOverride?: DiscountRateMethod[]; // A list of methods to use for valuation, in order of priority

  // === METRICS ===
  metrics?: BondMetrics;
}

// ============= FIXED RATE BOND =============
export interface FixedRateBondProps extends BaseBondProps {
  bondType: "FIXED";
  fixedRate: Percentage;  // Required for fixed rate bonds
  frequency: number;      // Payments per year
  firstCouponDate?: UTCDate; // To handle long-first coupon. Default is short-first coupon
}

// ============= ZERO COUPON BOND =============
export interface ZeroCouponBondProps extends BaseBondProps {
  bondType: "ZERO";
  frequency: 0; // Always 0 for zero coupon
}

// ============= DISCRIMINATED UNION =============
export type BondProps = FixedRateBondProps | ZeroCouponBondProps;
