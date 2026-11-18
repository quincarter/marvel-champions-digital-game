/**
 * Localized card names for the deck builder's search (issue #806): a Spanish player types "La Balsa" for The Raft. The
 * names are a data module fetched on first use, only when the card language is not English, so an English session
 * never pays for them. `cardSearchDocumentOf` adds the local name beside the English one, and the search worker
 * (accent-insensitive, `view/deck-search.ts`) matches either.
 */
import { BASE_CARD_LANGUAGE, type CardLanguage } from "../art/card-language.js";

type NameTable = Readonly<Record<string, string>>;

const loaded = new Map<CardLanguage, NameTable>();
const loading = new Map<CardLanguage, Promise<boolean>>();

/** Whether `localizedNameOf` can answer for `lang` now (English needs nothing). */
export const cardNamesReady = (lang: CardLanguage): boolean => lang === BASE_CARD_LANGUAGE || loaded.has(lang);

/** Brings in a language's name table; the default is the generated data module (tests inject their own). */
type NameImporter = (lang: CardLanguage) => Promise<NameTable>;
const importNames: NameImporter = (lang) =>
  lang === "es" ? import("../content/card-names-es.js").then((m) => m.CARD_NAMES_ES) : Promise.resolve({});

/**
 * Loads the language's name table. Resolves true once the table is loaded (at once for English and for a table already
 * loaded) and false when the import failed: a failure is not cached, so the next call retries rather than leaving the
 * search English-only for the session.
 */
export function loadCardNames(lang: CardLanguage, importer: NameImporter = importNames): Promise<boolean> {
  if (cardNamesReady(lang)) return Promise.resolve(true);
  let pending = loading.get(lang);
  if (!pending) {
    pending = importer(lang).then(
      (table) => {
        loaded.set(lang, table);
        loading.delete(lang);
        return true;
      },
      () => {
        loading.delete(lang);
        return false;
      },
    );
    loading.set(lang, pending);
  }
  return pending;
}

/** The card's name in `lang` when it differs from the English one and the table is loaded, else null. */
export function localizedNameOf(cardId: string, lang: CardLanguage): string | null {
  return loaded.get(lang)?.[cardId] ?? null;
}

/** Test hook: forget loaded tables. */
export function resetCardNamesForTest(): void {
  loaded.clear();
  loading.clear();
}
