/**
 * Which language a build's card scans are printed in (issue #337).
 *
 * Every build has a **build language** (`MC_CARD_LANG`, default English): `assets/card-art-locales/<lang>/` is laid
 * over the English scans when the build copies them (`vite-card-art.ts`), and every card the language's set lacks
 * keeps its English scan, decided then and there. The app at runtime never falls back by itself.
 *
 * A native installer carries its build language only: the desktop shell embeds `dist/` in its executable, and two sets
 * would pass GitHub's 2 GiB limit on a release asset. So each language is its own installer. The web has no such
 * limit, so its build carries every language (`MC_CARD_LANGS`), each already resolved, and the player picks one at
 * runtime (`Settings.cardLanguage`, `art-source.ts`'s `setArtLanguage`).
 *
 * Plain data with no imports, so `vite-card-art.ts` can read the list in Node too.
 */

/** The languages a build can be made in. English is the base every other language falls back to. */
export const CARD_LANGUAGES = ["en", "es"] as const;

export type CardLanguage = (typeof CARD_LANGUAGES)[number];

export const BASE_CARD_LANGUAGE: CardLanguage = "en";

/** Each language's own name, as a player looks for it in a list. */
export const CARD_LANGUAGE_NAMES: Readonly<Record<CardLanguage, string>> = { en: "English", es: "Español" };

export function isCardLanguage(value: string): value is CardLanguage {
  return (CARD_LANGUAGES as readonly string[]).includes(value);
}

/** The language this bundle was built in. Under Vitest, which doesn't run Vite's `define`, English. */
export function cardLanguage(): CardLanguage {
  return typeof __CARD_LANG__ === "string" && isCardLanguage(__CARD_LANG__) ? __CARD_LANG__ : BASE_CARD_LANGUAGE;
}

/**
 * Every language whose scans this bundle carries, its build language first: just that one in a native installer, all
 * of `CARD_LANGUAGES` on the web.
 */
export function availableCardLanguages(): readonly CardLanguage[] {
  const carried = typeof __CARD_LANGS__ === "string" ? __CARD_LANGS__.split(",").filter(isCardLanguage) : [];
  const build = cardLanguage();
  return [build, ...carried.filter((lang) => lang !== build)];
}

/**
 * The language a player who never picked one starts in: the first of the browser's languages (`navigator.languages`,
 * `es-MX` counts as `es`) that this bundle carries, else the build language.
 */
export function preferredCardLanguage(
  browserLanguages: readonly string[],
  available: readonly CardLanguage[] = availableCardLanguages(),
): CardLanguage {
  for (const tag of browserLanguages) {
    const lang = tag.toLowerCase().split("-")[0] ?? "";
    if (isCardLanguage(lang) && available.includes(lang)) return lang;
  }
  return available[0] ?? BASE_CARD_LANGUAGE;
}

/**
 * The language a release asset is built in, from its name (`scripts/lib/release-collector.mjs` puts it after the
 * version: `MarvelChampions-0.37.0-EN-Windows-x64-Setup.exe`, `MarvelChampions-0.37.0-ES-Android.apk`). An asset
 * without that tag is English, as every release before Spanish was.
 */
export function assetLanguage(name: string): CardLanguage | null {
  const tag = /^MarvelChampions-[^-]+-([A-Z]{2})-/.exec(name)?.[1]?.toLowerCase();
  if (tag === undefined) return BASE_CARD_LANGUAGE;
  return isCardLanguage(tag) ? tag : null;
}
