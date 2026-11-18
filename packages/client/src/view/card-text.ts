/**
 * Localized card text for display (issue #391): the name, rules text and flavor text a Spanish player reads beside a
 * card (the Inspect sheet, the hover popover's paper stand-in, a generated face), from MarvelCDB's Spanish site. The
 * table is a data module fetched on first use, only when the card language is not English, so an English session never
 * pays for it; until it arrives, and for any face it lacks, the English card data shows, the way the card art falls
 * back. The rules engine never reads it: it is display text only.
 */
import type { AnyCard } from "@mc/content";
import { uniqueLabel } from "@mc/engine";
import { BASE_CARD_LANGUAGE, type CardLanguage } from "../art/card-language.js";

/** One printed face's text in a language: `n` the name, `t` the rules text, `f` the flavor text, each when translated. */
export interface LocalizedFace {
  readonly n?: string;
  readonly t?: string;
  readonly f?: string;
}

type TextTable = Readonly<Record<string, LocalizedFace>>;

const loaded = new Map<CardLanguage, TextTable>();
const loading = new Map<CardLanguage, Promise<boolean>>();

/** Whether `localizedFaceOf` can answer for `lang` now (English needs nothing). */
export const cardTextReady = (lang: CardLanguage): boolean => lang === BASE_CARD_LANGUAGE || loaded.has(lang);

/** Brings in a language's text table; the default is the generated data module (tests inject their own). */
type TextImporter = (lang: CardLanguage) => Promise<TextTable>;
const importText: TextImporter = (lang) =>
  lang === "es" ? import("../content/card-text-es.js").then((m) => m.CARD_TEXT_ES) : Promise.resolve({});

/**
 * Loads the language's text table. Resolves true once it is loaded (at once for English and for a table already
 * loaded) and false when the import failed: a failure is not cached, so the next call retries.
 */
export function loadCardText(lang: CardLanguage, importer: TextImporter = importText): Promise<boolean> {
  if (cardTextReady(lang)) return Promise.resolve(true);
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

/** The printed face's text in `lang` (by its MarvelCDB code) when the table is loaded and has it, else null. */
export function localizedFaceOf(code: string | null, lang: CardLanguage): LocalizedFace | null {
  if (code === null || lang === BASE_CARD_LANGUAGE) return null;
  return loaded.get(lang)?.[code] ?? null;
}

/** Test hook: forget loaded tables. */
export function resetCardTextForTest(): void {
  loaded.clear();
  loading.clear();
}

/**
 * A card's list label (`uniqueLabel`, "Black Panther (T'Challa)") with its title in `lang` where the text table has it:
 * the deck builder's and the deck list's rows, beside a Spanish scan. The qualifier stays as printed.
 */
export function localizedLabelOf(card: AnyCard, lang: CardLanguage): string {
  const label = uniqueLabel(card);
  const name = localizedFaceOf(card.id as string, lang)?.n;
  return name !== undefined && label.startsWith(card.name) ? name + label.slice(card.name.length) : label;
}
