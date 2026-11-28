/**
 * The calls' words that come from the view models in English (a role's one-line summary and how it sits against the deck, the
 * Fear No Evil villain-method options), in the player's language. English passes through unchanged; Spanish is looked up here,
 * and a word with no Spanish entry (a pack campaign's own role) reads in English, never blank. The chrome (buttons, headings)
 * is in `t`; the box's plain words about a question are `campaign/briefing-text.ts`'s `setupCallCopyIn`.
 */
import type { CoreAspect } from "@mc/content";
import { artLanguageNow } from "../../../../art/art-source.js";
import type { CardLanguage } from "../../../../art/card-language.js";
import { t } from "../../../../i18n/translate.js";
import { aspectName } from "../../../../view/aspect-stamp.js";
import { ROLE_EXPLAINER } from "../../../../view/campaign-role-call-model.js";

/** The option ids of Fear No Evil step 5b (`@mc/cards`: `FNE_VILLAIN_LISTED` / `FNE_VILLAIN_RANDOM`); the log and the engine match them as written. */
export const FNE_VILLAIN_LISTED = "The next villain on the recommended list";
export const FNE_VILLAIN_RANDOM = "A random unrecorded villain";

const ROLE_SUMMARY_ES: Readonly<Record<string, string>> = {
  brawler: "El luchador de primera línea: golpea fuerte y aguanta el daño.",
  commander: "El líder del equipo: golpea fuerte y convoca aliados.",
  defender: "El guardián: detiene planes y mantiene a todos a salvo.",
  peacekeeper: "El organizador: detiene planes y forma el equipo.",
};

/** A role's one-line summary. */
export function roleSummaryIn(id: string, english: string, lang: CardLanguage = artLanguageNow()): string {
  return lang === "en" ? english : (ROLE_SUMMARY_ES[id] ?? english);
}

/** The Spanish list of aspects: "Agresividad y Protección". */
const listIn = (aspects: readonly CoreAspect[], lang: CardLanguage, joiner: string): string =>
  aspects.map((aspect) => aspectName(aspect, lang)).join(joiner);

/**
 * How a role's two aspects sit against the seat's deck aspects, in Spanish (`roleRelationOf` is the English): neither in the deck
 * "Añade A y B"; one in it "Se apoya en tu mazo de A y añade B"; both "Se apoya en tu mazo de A + B".
 */
export function roleRelationIn(
  roleAspects: readonly CoreAspect[],
  deckAspects: readonly CoreAspect[],
  english: string,
  lang: CardLanguage = artLanguageNow(),
): string {
  if (lang === "en") return english;
  const have = roleAspects.filter((aspect) => deckAspects.includes(aspect));
  const added = roleAspects.filter((aspect) => !deckAspects.includes(aspect));
  if (have.length === 0) return `Añade ${listIn(added, lang, " y ")}`;
  const deck = listIn(have, lang, " + ");
  return added.length === 0
    ? `Se apoya en tu mazo de ${deck}`
    : `Se apoya en tu mazo de ${deck} y añade ${listIn(added, lang, " y ")}`;
}

/** The "What roles do" note's three lines. */
export function roleExplainerIn(lang: CardLanguage = artLanguageNow()): {
  readonly heading: string;
  readonly upgrades: string;
  readonly building: string;
  readonly rule: string;
} {
  if (lang === "en") return ROLE_EXPLAINER;
  return {
    heading: t("briefing.call.role.heading", undefined, lang),
    upgrades: t("briefing.call.role.upgrades", undefined, lang),
    building: t("briefing.call.role.building", undefined, lang),
    rule: t("briefing.call.role.rule", undefined, lang),
  };
}

/** An option's label: the Fear No Evil villain-method buttons are translated; every other label is the card's own name or id words. */
export function optionLabelIn(optionId: string, label: string, lang: CardLanguage = artLanguageNow()): string {
  if (optionId === FNE_VILLAIN_LISTED) return t("briefing.call.villain.listed", undefined, lang);
  if (optionId === FNE_VILLAIN_RANDOM) return t("briefing.call.villain.random", undefined, lang);
  return label;
}
