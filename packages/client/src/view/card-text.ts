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
import { announceLanguageChange } from "../language-change.js";

/** One printed face's text in a language: `n` the name, `t` the rules text, `f` the flavor text, each when translated. */
export interface LocalizedFace {
  readonly n?: string;
  readonly t?: string;
  /** Fingerprint of the English rules text `t` translates (`textFingerprint`); `t` shows only on a face that matches. */
  readonly e?: string;
  /** For a face with no rules text: fingerprint of the English flavor `f` translates. */
  readonly g?: string;
  readonly f?: string;
}

/**
 * FNV-1a over the text's letters and digits, lowercased, in base 36: the generator's `fingerprint`
 * (`packages/content/scripts/card-text-es.ts`), which a test pins to the same value.
 */
export function textFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
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

/** How long `bringInCardText` waits before each retry of a failed load. */
const RETRY_DELAYS_MS: readonly number[] = [2_000, 10_000, 30_000, 60_000];

/**
 * Loads the language's text in the background and, once it is in, announces a language change so every screen built
 * meanwhile with the English fallback (an open Inspect sheet, a deck list) redraws in the language. A failed load retries
 * on its own, after each of `RETRY_DELAYS_MS`. The session calls this at boot and on every change of card language.
 */
export function bringInCardText(
  lang: CardLanguage,
  opts: {
    readonly importer?: TextImporter;
    readonly announce?: () => void;
    readonly schedule?: (retry: () => void, ms: number) => void;
  } = {},
): void {
  if (cardTextReady(lang)) return;
  const announce = opts.announce ?? announceLanguageChange;
  const schedule = opts.schedule ?? ((retry, ms) => void setTimeout(retry, ms));
  const attempt = (tries: number): void => {
    void loadCardText(lang, opts.importer).then((ok) => {
      if (ok) announce();
      else if (tries < RETRY_DELAYS_MS.length) schedule(() => attempt(tries + 1), RETRY_DELAYS_MS[tries]!);
    });
  };
  attempt(0);
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
