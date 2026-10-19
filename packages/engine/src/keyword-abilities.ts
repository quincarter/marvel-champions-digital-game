/**
 * Keywords the RRG defines as shorthand for a triggered ability: the engine owns those abilities, so no card script
 * repeats them. Each is offered in a timing window exactly as a printed ability is (`candidatesFor`), on every card in
 * play that has the keyword at that moment (`hasKeyword`: a lost keyword exempts the card, a granted one counts), and
 * resolves through the same ability frame. Their ids carry a `keyword:` head no card ability id has.
 */

import { abilityId, type AbilityId } from "@mc/content";
import type { AbilityDefinition } from "./abilities.js";

/** The keywords the engine resolves as abilities of its own; `keywordResolved` names them. */
export type KeywordAbilityName = "temporary" | "villainous";

export interface KeywordAbility {
  readonly keyword: KeywordAbilityName;
  readonly abilityId: AbilityId;
  readonly definition: AbilityDefinition;
}

/**
 * RRG 1.8 "Temporary" (p. 44): "A card with temporary must be discarded from play at the end of the round", equivalent
 * to "Forced Interrupt: When the round ends, discard this card from play." The round ends with the villain phase
 * (`phaseEnding { phase: "villain" }`, `flow.ts` `executeEndOfRound`), or without one when it was skipped
 * (`phase: "round"`, docs/phase7-wave11-hero-packs.md H3.7). docs/phase7-wave6.md §3.26.
 */
export const TEMPORARY_ABILITY: KeywordAbility = {
  keyword: "temporary",
  abilityId: abilityId("keyword:temporary"),
  definition: {
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseEnding", eventIs: { phase: ["villain", "round"] } } },
    effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
  },
};

/**
 * RRG 1.8 "Villainous" (p. 47): "The villainous keyword is equivalent to the following triggered ability: 'Forced
 * Interrupt: When this character uses a basic power, give it a boost card.'" The card comes facedown from the top of the
 * encounter deck (`giveBoostCard`). This is the keyword on a character that is not an enemy, an ally or a hero (MC60
 * p. 26 FAQ: "The rules for villainous have been revised to function for allies (and heroes) who have it"; Black Cat
 * 60169 as an ally; docs/phase7-wave11-scenarios.md §S3.7): only those make a basic power the `basicPowerUsing` event
 * hears. An enemy's activation gives its own card (`resolve/enemy-activation.ts` `giveBoostCard`, RRG 1.8 "Attack
 * (Enemy Activation)" step 1, p. 8), and the pattern leaves enemies out. The card is turned faceup and resolved as the
 * power resolves, and discarded after it, by the `characterBoost` frames (`resolve/villainous.ts`).
 */
export const VILLAINOUS_ABILITY: KeywordAbility = {
  keyword: "villainous",
  abilityId: abilityId("keyword:villainous"),
  definition: {
    trigger: {
      kind: "interrupt",
      forced: true,
      on: {
        on: "basicPowerUsing",
        selfIs: "source",
        // Not an enemy: an enemy's activation gives its own card (RRG 1.8 "Attack (Enemy Activation)" step 1, p. 8).
        sourceIs: { not: { categories: ["enemy"] } },
        // An ally's defense is no use of a basic power: "Defense power (DEF) can be used by a character to perform a
        // basic defense … Generally, only heroes have defense power" (RRG 1.8 "Basic Power", p. 10), and "A hero can
        // use their basic defense power … An ally can exhaust to defend" (RRG 1.8 "Defend, Defense", p. 15). A
        // recovery is a basic power (p. 10: "Recovery power (REC) can be used by a character to perform a basic
        // recovery").
        anyOf: [
          { on: "basicPowerUsing", eventIs: { power: ["attack", "thwart", "recover"] } },
          { on: "basicPowerUsing", eventIs: { power: "defense" }, sourceIs: { categories: ["hero"] } },
        ],
      },
    },
    effects: [{ kind: "giveBoostCard", enemy: { kind: "self" } }],
  },
};

export const KEYWORD_ABILITIES: readonly KeywordAbility[] = [TEMPORARY_ABILITY, VILLAINOUS_ABILITY];

/** The keyword ability with this id, if it is one. */
export const keywordAbilityOf = (id: AbilityId): KeywordAbility | undefined =>
  KEYWORD_ABILITIES.find((ability) => ability.abilityId === id);
