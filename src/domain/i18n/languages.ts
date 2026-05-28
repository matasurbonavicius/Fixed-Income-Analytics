// Canonical list of languages supported across the platform.
// Domain owns this so storage helpers (parseLocalized / pickLocale) can be
// loaded without depending on the presentation layer's i18n bootstrap.
//
// To add a new language: extend SUPPORTED_LANGUAGES, add the locale file
// under presentation/src/shared/lib/i18n/locales/, and add a row to the
// bondEnums namespace in that file. No storage migration is required —
// LocalizedString is an open map keyed by these codes.

export const SUPPORTED_LANGUAGES = ["en", "lt"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

// Normalize anything the runtime may hand us ("en-US", "LT", undefined) to one
// of the supported codes — falling back to DEFAULT_LANGUAGE.
export function normalizeLanguage(input: string | null | undefined): SupportedLanguage {
  if (!input) return DEFAULT_LANGUAGE;
  const head = input.toLowerCase().split(/[-_]/)[0];
  return isSupportedLanguage(head) ? head : DEFAULT_LANGUAGE;
}
