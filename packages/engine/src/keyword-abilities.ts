/**
 * Keywords the RRG defines as shorthand for a triggered ability: the engine owns those abilities, so no card script
 * repeats them. Each is offered in a timing window exactly as a printed ability is (`candidatesFor`), on every card in
 * play that has the keyword at that moment (`hasKeyword`: a lost keyword exempts the card, a granted one counts), and
 * resolves through the same ability frame. Their ids carry a `keyword:` head no card ability id has.
 */

import { abilityId, type AbilityId } from "@mc/content";
import type { AbilityDefinition } from "./abilities.js";

/** The keywords the engine resolves as abilities of its own; `keywordResolved` names them. */
export type KeywordAbilityName = "temporary";

export interface KeywordAbility {
  readonly keyword: KeywordAbilityName;
  readonly abilityId: AbilityId;
  readonly definition: AbilityDefinition;
}

/**
 * RRG 1.8 "Temporary" (p. 44): "A card with temporary must be discarded from play at the end of the round", equivalent
 * to "Forced Interrupt: When the round ends, discard this card from play." The round ends with the villain phase
 * (`phaseEnding { phase: "villain" }`, `flow.ts` `executeEndOfRound`). docs/phase7-wave6.md §3.26.
 */
export const TEMPORARY_ABILITY: KeywordAbility = {
  keyword: "temporary",
  abilityId: abilityId("keyword:temporary"),
  definition: {
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: "villain" } } },
    effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
  },
};

export const KEYWORD_ABILITIES: readonly KeywordAbility[] = [TEMPORARY_ABILITY];

/** The keyword ability with this id, if it is one. */
export const keywordAbilityOf = (id: AbilityId): KeywordAbility | undefined =>
  KEYWORD_ABILITIES.find((ability) => ability.abilityId === id);
