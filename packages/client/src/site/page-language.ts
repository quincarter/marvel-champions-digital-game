/**
 * The language the moved page and the landing page read in, picked the way the release history page picks its own
 * (`public/releases/history.js`): `?lang=` first, then the toggle's last choice, then the game's card language (its
 * saved setting, else the browser's languages), else English. The toggle shares the release pages' storage key, so a
 * choice made on one carries to the others on the same origin.
 *
 * The languages are the game's own (`art/card-language.ts`, which `i18n/translate.ts`'s catalogs are keyed by), so a
 * language the game adds shows up here and a page's catalog type then asks for its text.
 */
import { CARD_LANGUAGES, CARD_LANGUAGE_NAMES, type CardLanguage } from "../art/card-language.js";

export type PageLanguage = CardLanguage;

export const PAGE_LANGUAGES: readonly PageLanguage[] = CARD_LANGUAGES;
export const LANGUAGE_NAMES = CARD_LANGUAGE_NAMES;

export const LANGUAGE_KEY = "mc-release-language";
const SETTINGS_KEY = "mc-settings";

export interface LanguageSources {
  /** `location.search`. */
  readonly search: string;
  /** Reads `localStorage`; `null` for a missing key or blocked storage. */
  readonly read: (key: string) => string | null;
  /** `navigator.languages`. */
  readonly browser: readonly string[];
}

const isLanguage = (value: unknown): value is PageLanguage =>
  typeof value === "string" && (PAGE_LANGUAGES as string[]).includes(value);

/** The game's card language: its saved setting, else the first browser language the pages have. */
function gameLanguage({ read, browser }: LanguageSources): PageLanguage {
  try {
    const saved: unknown = (JSON.parse(read(SETTINGS_KEY) ?? "{}") as { cardLanguage?: unknown }).cardLanguage;
    if (isLanguage(saved)) return saved;
  } catch {
    // A settings record this page can't read says nothing about the language.
  }
  return browser.map((tag) => tag.toLowerCase().split("-")[0]).find(isLanguage) ?? "en";
}

export function pickLanguage(sources: LanguageSources): PageLanguage {
  const asked = new URLSearchParams(sources.search).get("lang");
  if (isLanguage(asked)) return asked;
  const chosen = sources.read(LANGUAGE_KEY);
  return isLanguage(chosen) ? chosen : gameLanguage(sources);
}

export function storageRead(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageWrite(key: string, value: string): void {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked storage just don't remember.
  }
}

export function browserLanguage(): PageLanguage {
  return pickLanguage({ search: location.search, read: storageRead, browser: navigator.languages ?? [] });
}
