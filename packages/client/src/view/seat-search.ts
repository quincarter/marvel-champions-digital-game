/**
 * The words Take your seats indexes for a deck's aspects and source, in every language the app has (#390), so a search
 * finds "Masacrismo" or "Propio" as well as "'Pool" or "Built" whatever the language. The document a deck gets is then
 * the same in every language, and the search worker's cache (keyed on the pool version and the deck ids) stays right
 * across a language switch.
 */
import type { CoreAspect, Deck } from "@mc/content";
import { APP_LANGUAGES, t, type MessageKey } from "../i18n/translate.js";
import { aspectName } from "./aspect-stamp.js";

const SOURCE_KEYS: Readonly<Record<Deck["source"]["kind"], readonly MessageKey[]>> = {
  precon: ["deckSource.precon", "deckSource.preconLong"],
  imported: ["deckSource.imported"],
  userBuilt: ["deckSource.built", "deckSource.mine"],
};

export function seatSearchWordsOf(
  aspects: readonly CoreAspect[],
  sourceKind: Deck["source"]["kind"],
  tested: boolean,
): readonly string[] {
  const keys: readonly MessageKey[] = [...SOURCE_KEYS[sourceKind], ...(tested ? (["deckSource.tested"] as const) : [])];
  const words = APP_LANGUAGES.flatMap((lang) => [
    ...aspects.map((aspect) => aspectName(aspect, lang)),
    ...keys.map((key) => t(key, undefined, lang).toLowerCase()),
  ]);
  return [...new Set(words)];
}
