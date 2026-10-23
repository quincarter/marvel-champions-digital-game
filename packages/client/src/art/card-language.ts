/**
 * Which language a build's card scans are printed in (issue #337).
 *
 * The language is a **build** choice, not a setting: each language ships as its own build, so no build carries more
 * than one set of scans (the desktop shell embeds `dist/` in its executable, and two sets would pass GitHub's size cap
 * on a release asset). `MC_CARD_LANG=es` lays `assets/card-art-locales/es/` over the English scans when the build
 * copies them (`vite-card-art.ts`), and every card the language set lacks keeps its English scan, decided then and
 * there. The app at runtime loads the same `/card-art/` paths in every language and never falls back by itself.
 *
 * Plain data with no imports, so `vite-card-art.ts` can read the list in Node too.
 */

/** The languages a build can be made in. English is the base every other language falls back to. */
export const CARD_LANGUAGES = ["en", "es"] as const;

export type CardLanguage = (typeof CARD_LANGUAGES)[number];

export const BASE_CARD_LANGUAGE: CardLanguage = "en";

export function isCardLanguage(value: string): value is CardLanguage {
  return (CARD_LANGUAGES as readonly string[]).includes(value);
}

/** The language this bundle was built in. Under Vitest, which doesn't run Vite's `define`, English. */
export function cardLanguage(): CardLanguage {
  return typeof __CARD_LANG__ === "string" && isCardLanguage(__CARD_LANG__) ? __CARD_LANG__ : BASE_CARD_LANGUAGE;
}

/**
 * The language a release asset is built in, from its name (`scripts/lib/release-collector.mjs` names a non-English
 * build's installers with the language after the version: `MarvelChampions-0.37.0-ES-Windows-x64-Setup.exe`). An
 * asset without that tag is English, as every release before Spanish was.
 */
export function assetLanguage(name: string): CardLanguage | null {
  const tag = /^MarvelChampions-[^-]+-([A-Z]{2})-/.exec(name)?.[1]?.toLowerCase();
  if (tag === undefined) return BASE_CARD_LANGUAGE;
  return isCardLanguage(tag) ? tag : null;
}
