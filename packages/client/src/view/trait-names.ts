/**
 * Printed traits in Spanish, for the sentences the app words itself ("aliado Vengador"). Keyed by the English trait in
 * upper case, as the card data holds it; a trait with no entry here is shown as the English one, never guessed at.
 * Only traits whose Spanish print is known are listed; extend this as scans confirm more.
 */
import { BASE_CARD_LANGUAGE, type CardLanguage } from "../art/card-language.js";

const TRAITS_ES: Readonly<Record<string, string>> = {
  AVENGER: "Vengador",
  "X-MEN": "X-Men",
  "DORA MILAJE": "Dora Milaje",
  "S.H.I.E.L.D.": "S.H.I.E.L.D.",
  GUARDIAN: "Guardián",
  ELITE: "Élite",
  SPELL: "Hechizo",
};

/** The trait in `lang` when the catalog has it, else null (the caller keeps the English trait). */
export function localizedTraitOf(trait: string, lang: CardLanguage): string | null {
  if (lang === BASE_CARD_LANGUAGE) return null;
  return lang === "es" ? (TRAITS_ES[trait.trim().toUpperCase()] ?? null) : null;
}
