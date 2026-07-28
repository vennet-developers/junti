import { en } from "./en";
import { es, type Copy } from "./es";

export type { Copy };

/**
 * The languages the interface exists in.
 *
 * Adding one means adding a file next to `es.ts` and a line here. There is no
 * extraction step, no message catalogue and no runtime i18n library: the whole
 * mechanism is an object per language, checked by the compiler.
 */
export const LOCALES = ["es", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Spanish, because the group this was built for speaks it and a stranger
 * opening a WhatsApp link should not land on a language nobody in the chat
 * picked.
 */
export const DEFAULT_LOCALE: Locale = "es";

const CATALOGUE: Record<Locale, Copy> = { es, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getCopy(locale: Locale): Copy {
  return CATALOGUE[locale];
}

/**
 * Picks a supported language out of an `Accept-Language` header.
 *
 * Quality values are parsed but the header is already in preference order in
 * every browser that matters, so this walks it in order and takes the first
 * language subtag it recognises — "es-419", "es-CO" and "es" all resolve to
 * Spanish. Returns null when nothing matches, which is the caller's cue to fall
 * back rather than to guess.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;

  const entries = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);

      const quality = q === undefined ? 1 : Number.parseFloat(q);

      return { tag: tag.trim().toLowerCase(), quality: Number.isNaN(quality) ? 0 : quality };
    })
    .filter((entry) => entry.tag !== "" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const entry of entries) {
    const base = entry.tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return null;
}
