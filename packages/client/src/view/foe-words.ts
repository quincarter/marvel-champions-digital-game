/**
 * The word the scenario screens use for the opposing card: "villain", or "leader" for a Civil War scenario (a
 * `VillainCard` with `printedType: "leader"`; MC56 p. 3, leaders "function exactly the same as villains"). One helper
 * decides it from the card so no screen guesses. "Villain Phase" is the phase's rules name and is never routed through
 * here.
 */
import type { AnyCard, Scenario } from "@mc/content";
import type { CardLanguage } from "../art/card-language.js";
import { t } from "../i18n/translate.js";
import { hasRandomVillain } from "./random-villain.js";

export interface FoeWordOptions {
  /** Resolves a scenario's `villainCardId`; without it a scenario reads as a villain. */
  readonly cardsById?: ReadonlyMap<string, AnyCard>;
  /** "villains" / "leaders". Default: plural for a scenario fought against several villains at once, else singular. */
  readonly plural?: boolean;
  /** The language to word it in. English unless a translated screen asks for its own: the log and the board's English text mustn't pick up another language's word. */
  readonly lang?: CardLanguage;
  /** "villain" / "leader" instead of "Villain" / "Leader". */
  readonly lower?: boolean;
}

/** True for a Civil War leader: a villain-type card printed as a leader. */
export const isLeaderCard = (card: AnyCard | undefined): boolean =>
  card?.type === "villain" && card.printedType === "leader";

const isScenario = (subject: AnyCard | Scenario): subject is Scenario => "villainCardId" in subject;

/**
 * "Villain"/"Leader" (or lower case / plural, per `options`) for a card or a scenario. A scenario whose opening
 * villain is not known yet (`bySetup`, a random family) keeps the villain wording.
 */
export function foeWord(subject: AnyCard | Scenario | undefined, options: FoeWordOptions = {}): string {
  let leader = false;
  let plural = options.plural ?? false;
  if (subject !== undefined && isScenario(subject)) {
    if (options.plural === undefined) plural = subject.multipleVillains !== undefined;
    leader = !hasRandomVillain(subject) && isLeaderCard(options.cardsById?.get(subject.villainCardId as string));
  } else {
    leader = isLeaderCard(subject);
  }
  const lang = options.lang ?? "en";
  // Each language has its own lower-case forms: Spanish game terms stay capitalized ("Jugar este Villano").
  if (options.lower) {
    return leader
      ? t(plural ? "foe.leadersLower" : "foe.leaderLower", undefined, lang)
      : t(plural ? "foe.villainsLower" : "foe.villainLower", undefined, lang);
  }
  return leader
    ? t(plural ? "foe.leaders" : "foe.leader", undefined, lang)
    : t(plural ? "foe.villains" : "foe.villain", undefined, lang);
}
