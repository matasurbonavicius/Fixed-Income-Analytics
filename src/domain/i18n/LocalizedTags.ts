// LocalizedTags — language-aware view over a flat `text[]` tag column.
//
// Storage convention
// ------------------
// Tags live in the existing `tags text[]` column. Each entry is either:
//   (a) `"value"`          → language-neutral, displayed to every language
//   (b) `"xx:value"`       → only displayed when xx is the active language
// Example:  ["en:bank", "lt:bankas", "green"]
//   → EN users see ["bank", "green"]
//   → LT users see ["bankas", "green"]
//
// Keeping the prefix convention inside a single array avoids a schema change
// and means existing tag rows (plain strings) keep working as neutral tags.

import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  isSupportedLanguage,
  normalizeLanguage,
} from "./languages";

// Internal model the admin form / mapper work with. `neutral` are tags that
// have no language prefix and should always be displayed.
export interface LocalizedTags {
  neutral: string[];
  byLanguage: Partial<Record<SupportedLanguage, string[]>>;
}

const PREFIX_SEPARATOR = ":";

// Parse a raw `text[]` row into the LocalizedTags model. Idempotent and
// resilient to nulls, non-strings, blanks, and duplicate entries.
export function parseTags(input: readonly unknown[] | null | undefined): LocalizedTags {
  const neutral: string[] = [];
  const byLanguage: Partial<Record<SupportedLanguage, string[]>> = {};

  if (!input) return { neutral, byLanguage };

  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const sepIdx = trimmed.indexOf(PREFIX_SEPARATOR);
    if (sepIdx > 0 && sepIdx <= 5) {
      const prefix = trimmed.slice(0, sepIdx).toLowerCase();
      const value = trimmed.slice(sepIdx + 1).trim();
      if (value && isSupportedLanguage(prefix)) {
        const bucket = byLanguage[prefix] ?? [];
        if (!bucket.includes(value)) bucket.push(value);
        byLanguage[prefix] = bucket;
        continue;
      }
    }

    if (!neutral.includes(trimmed)) neutral.push(trimmed);
  }

  return { neutral, byLanguage };
}

// Serialize back to the flat array shape for storage. Empty buckets are
// pruned. Returns null when no tags remain (consumer can drop the column).
export function serializeTags(value: LocalizedTags): string[] | null {
  const out: string[] = [];

  for (const tag of value.neutral) {
    const t = tag.trim();
    if (t && !out.includes(t)) out.push(t);
  }

  for (const code of SUPPORTED_LANGUAGES) {
    for (const tag of value.byLanguage[code] ?? []) {
      const t = tag.trim();
      if (!t) continue;
      const encoded = `${code}${PREFIX_SEPARATOR}${t}`;
      if (!out.includes(encoded)) out.push(encoded);
    }
  }

  return out.length > 0 ? out : null;
}

// Pick the tags a user in `language` should see — neutral tags plus their
// language-specific bucket. Used at every render site that displays tags.
export function pickTagsForLocale(
  value: LocalizedTags | readonly unknown[] | null | undefined,
  language: string | null | undefined,
): string[] {
  const lang = normalizeLanguage(language);
  const tags = Array.isArray(value) ? parseTags(value) : (value as LocalizedTags | null | undefined);
  if (!tags) return [];
  return [...tags.neutral, ...(tags.byLanguage[lang] ?? [])];
}

// Project all populated tag values into a flat list — for AI search filter
// options and screener aggregates that need every tag regardless of language.
export function flattenAllTags(
  value: LocalizedTags | readonly unknown[] | null | undefined,
): string[] {
  const tags = Array.isArray(value) ? parseTags(value) : (value as LocalizedTags | null | undefined);
  if (!tags) return [];
  const out = [...tags.neutral];
  for (const code of SUPPORTED_LANGUAGES) {
    for (const tag of tags.byLanguage[code] ?? []) {
      if (!out.includes(tag)) out.push(tag);
    }
  }
  return out;
}

// Build an empty model the form can mutate.
export function emptyTags(): LocalizedTags {
  return { neutral: [], byLanguage: {} };
}

// Used by the admin form's "import as default-language tag" affordance and
// by tests that need a quick constructor.
export function tagsFromArrays(
  byLanguage: Partial<Record<SupportedLanguage, string[]>>,
  neutral: string[] = [],
): LocalizedTags {
  return { neutral: [...neutral], byLanguage: { ...byLanguage } };
}

export { DEFAULT_LANGUAGE as DEFAULT_TAG_LANGUAGE };
