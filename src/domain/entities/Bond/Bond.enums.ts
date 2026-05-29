/**
 * @category Bond Types & Shapes
 */
export type BondType = "FIXED" | "ZERO";

/**
 * @category Bond Types & Shapes
 */
export type BondCategory =
  | "SOVEREIGN"        // Government bonds (Treasuries, Gilts, Bunds)
  | "CORPORATE"        // Corporate bonds
  | "MUNICIPAL"        // Munis (US state/local)
  | "AGENCY"           // Government-sponsored (Fannie, Freddie)
  | "SUPRANATIONAL"    // World Bank, EIB, IMF
  | "COVERED"          // Covered bonds (European)
  | "MBS"              // Mortgage-backed
  | "ABS"              // Asset-backed
  | "CONVERTIBLE";     // Convertible bonds

// What sector is the issuer in? (mostly for corporates)
/**
 * @category Bond Types & Shapes
 */
export type IssuerSector =
  | "GOVERNMENT"
  | "FINANCIALS"
  | "INDUSTRIALS"
  | "UTILITIES"
  | "TECHNOLOGY"
  | "HEALTHCARE"
  | "ENERGY"
  | "MATERIALS"
  | "CONSUMER_CYCLICAL"
  | "CONSUMER_DEFENSIVE"
  | "REAL_ESTATE"
  | "TELECOM";

/**
 * @category Calendars & Day-Count
 */
export type BusinessDayConvention =
  | "FOLLOWING"
  | "MODIFIED_FOLLOWING"
  | "PRECEDING"
  | "MODIFIED_PRECEDING"
  | "UNADJUSTED";
  
/**
 * @category Formula Registry
 */
export const DISCOUNT_RATE_METHODS = [
  "implied_from_price",
  "official_rating",
  "internal_rating",
  "manual_spread",
  "manual_rate"
] as const;

/**
 * @category Formula Registry
 */
export type DiscountRateMethod = typeof DISCOUNT_RATE_METHODS[number];

/**
 * @category Bond Types & Shapes
 */
export type CountryCode =
  // === MAJOR MARKETS ===
  | "US"  // United States
  | "GB"  // United Kingdom
  | "JP"  // Japan
  | "CN"  // China
  | "CA"  // Canada
  | "AU"  // Australia
  | "NZ"  // New Zealand
  | "SG"  // Singapore
  | "HK"  // Hong Kong
  | "IN"  // India
  | "BR"  // Brazil
  | "MX"  // Mexico
  | "ZA"  // South Africa
  | "KR"  // South Korea
  | "CH"  // Switzerland
  
  // === ALL EUROPEAN COUNTRIES ===
  | "AL"  // Albania
  | "AD"  // Andorra
  | "AT"  // Austria
  | "BY"  // Belarus
  | "BE"  // Belgium
  | "BA"  // Bosnia and Herzegovina
  | "BG"  // Bulgaria
  | "HR"  // Croatia
  | "CY"  // Cyprus
  | "CZ"  // Czech Republic
  | "DK"  // Denmark
  | "EE"  // Estonia
  | "FI"  // Finland
  | "FR"  // France
  | "DE"  // Germany
  | "GR"  // Greece
  | "HU"  // Hungary
  | "IS"  // Iceland
  | "IE"  // Ireland
  | "IT"  // Italy
  | "XK"  // Kosovo
  | "LV"  // Latvia
  | "LI"  // Liechtenstein
  | "LT"  // Lithuania
  | "LU"  // Luxembourg
  | "MT"  // Malta
  | "MD"  // Moldova
  | "MC"  // Monaco
  | "ME"  // Montenegro
  | "NL"  // Netherlands
  | "MK"  // North Macedonia
  | "NO"  // Norway
  | "PL"  // Poland
  | "PT"  // Portugal
  | "RO"  // Romania
  | "RU"  // Russia
  | "SM"  // San Marino
  | "RS"  // Serbia
  | "SK"  // Slovakia
  | "SI"  // Slovenia
  | "ES"  // Spain
  | "SE"  // Sweden
  | "TR"  // Turkey
  | "UA"  // Ukraine
  | "VA"; // Vatican City