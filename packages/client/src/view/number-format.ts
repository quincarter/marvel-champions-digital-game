/**
 * Numbers as the player's language writes them: one decimal with the language's own mark ("1.8", "1,8"), and a count
 * with its grouping ("1065" in English reads "1.065" in Spanish where the language groups four digits; es does not
 * group four-digit numbers, so "1065").
 */
import { artLanguageNow } from "../art/art-source.js";
import type { CardLanguage } from "../art/card-language.js";

/** `value` with exactly one decimal, in `lang`'s decimal mark. */
export function oneDecimal(value: number, lang: CardLanguage = artLanguageNow()): string {
  return new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

const countFormats = new Map<string, Intl.NumberFormat>();

/**
 * A count in `lang`'s grouping ("1,065" in English; Spanish groups from five digits, so "1065" and "12.345"). One
 * formatter per language is kept: making one costs milliseconds the first time (issue #722).
 */
export function formatCount(count: number, lang: CardLanguage = artLanguageNow()): string {
  const locale = lang === "en" ? "en-US" : lang;
  let format = countFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale);
    countFormats.set(locale, format);
  }
  return format.format(count);
}
