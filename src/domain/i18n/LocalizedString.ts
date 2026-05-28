// LocalizedString — the platform's single representation of "text content
// that can vary per language" (bond name, description, issuer, etc.).
//
// Storage convention
// ------------------
// Bond text fields are stored in existing TEXT columns and can hold:
//   (a) a plain string  → treated as { [DEFAULT_LANGUAGE]: value } (legacy data)
//   (b) a JSON-encoded LocalizedString  → '{"en":"…","lt":"…"}'
// `parseLocalized` accepts either form and returns a canonical LocalizedString,
// so callers never have to branch on shape. `serializeLocalized` writes back
// in the most compact form (plain string when only the default language is
// populated, JSON otherwise) so the database stays readable and existing
// single-language consumers keep working.
//
// Display convention
// ------------------
// Use `pickLocale(value, lang)` to resolve a UI string. When the requested
// language has no content, the resolver returns undefined by default — the
// product rule is "show nothing rather than the wrong language" so users in
// EN don't see a Lithuanian description bleeding through.

import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  isSupportedLanguage,
  normalizeLanguage,
} from "./languages";

export type LocalizedString = Partial<Record<SupportedLanguage, string>>;

// Anything we might pull from the database, an API response, or a form.
export type LocalizedInput =
  | LocalizedString
  | string
  | null
  | undefined;

// Coerce arbitrary input (legacy plain string, JSON-encoded object, real
// object, null) into a canonical LocalizedString. Empty strings are dropped
// so `isLocalizedEmpty` and `pickLocale` agree.
export function parseLocalized(input: LocalizedInput): LocalizedString {
  if (input === null || input === undefined) return {};

  if (typeof input === "object") {
    return sanitize(input as Record<string, unknown>);
  }

  const trimmed = input.trim();
  if (!trimmed) return {};

  // Try JSON only when it looks like an object — avoids accidentally parsing
  // numeric strings or quoted scalars from legacy data.
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return sanitize(parsed as Record<string, unknown>);
      }
    } catch {
      // Not valid JSON — fall through and treat as plain string.
    }
  }

  return { [DEFAULT_LANGUAGE]: trimmed };
}

// Serialize for storage in a TEXT column. Single-language content collapses
// back to a plain string so the database value reads naturally for ops /
// support, and so legacy consumers that haven't been updated keep seeing
// human-readable text. Empty maps become null.
export function serializeLocalized(value: LocalizedString): string | null {
  const entries = Object.entries(value).filter(
    ([, v]) => typeof v === "string" && v.trim().length > 0,
  ) as [SupportedLanguage, string][];

  if (entries.length === 0) return null;

  // Only the default language is populated — store as plain text. This keeps
  // single-language bonds indistinguishable from legacy data.
  if (entries.length === 1 && entries[0][0] === DEFAULT_LANGUAGE) {
    return entries[0][1];
  }

  return JSON.stringify(Object.fromEntries(entries));
}

// Resolve a display string for `language`. Returns the requested language's
// value or undefined — by design we do NOT fall through to another language,
// because a Lithuanian sentence shown to an English user is worse than no
// description at all. Pass `fallbackToAny: true` to enable cross-language
// fallback for surfaces (e.g. AI search context) where any text beats none.
export function pickLocale(
  value: LocalizedInput,
  language: string | null | undefined,
  options?: { fallbackToAny?: boolean },
): string | undefined {
  const localized = parseLocalized(value);
  const lang = normalizeLanguage(language);
  const direct = localized[lang];
  if (direct && direct.trim().length > 0) return direct;

  if (options?.fallbackToAny) {
    // Prefer default language, then any other populated value.
    const def = localized[DEFAULT_LANGUAGE];
    if (def && def.trim().length > 0) return def;
    for (const code of SUPPORTED_LANGUAGES) {
      const v = localized[code];
      if (v && v.trim().length > 0) return v;
    }
  }
  return undefined;
}

// True when no language has content. Used by form validation + by reader
// code to decide whether to render an entire section (e.g. "if no
// description in any language, hide the description block").
export function isLocalizedEmpty(value: LocalizedInput): boolean {
  const localized = parseLocalized(value);
  return Object.values(localized).every(
    (v) => v === undefined || v === null || (typeof v === "string" && v.trim().length === 0),
  );
}

// True if any language has content. Inverse of isLocalizedEmpty.
export function hasAnyLocale(value: LocalizedInput): boolean {
  return !isLocalizedEmpty(value);
}

// Project all populated values into a single search/index blob. Used by
// search/AI surfaces where matching across languages is desirable
// (a user typing "obligacijos" should match an English-described bond
// that also has Lithuanian content).
export function localizedToSearchText(value: LocalizedInput): string {
  const localized = parseLocalized(value);
  return Object.values(localized)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" ");
}

// Lookup helper for cases where the caller already knows the language code
// and just wants a typed accessor — keeps reader call sites concise.
export function getLocale(
  value: LocalizedInput,
  language: SupportedLanguage,
): string | undefined {
  return parseLocalized(value)[language];
}

// Strip non-string entries and unsupported language codes. Centralised so
// every reader applies the same hygiene rules.
function sanitize(input: Record<string, unknown>): LocalizedString {
  const out: LocalizedString = {};
  for (const [key, raw] of Object.entries(input)) {
    const code = key.toLowerCase().split(/[-_]/)[0];
    if (!isSupportedLanguage(code)) continue;
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    out[code] = trimmed;
  }
  return out;
}
