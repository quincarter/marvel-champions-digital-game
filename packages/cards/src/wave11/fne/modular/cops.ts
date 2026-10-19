import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  boost,
  chooseCards,
  chosen,
  constant,
  dealEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterUntil,
  encounterCards,
  enemyAttacksEnemy,
  forcedInterrupt,
  gainsKeyword,
  heroAction,
  instead,
  on,
  placeThreat,
  putIntoPlay,
  query,
  revealCard,
  self,
  shuffleEncounterDeck,
  theMainScheme,
  theVillain,
  whenDefeated,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const POLICE_MINION = query("minion", { trait: trait("POLICE") });

/**
 * The Cops modular set (docs/phase7-wave11-scenarios.md section S6). Quickstrike, Vulnerable and Hinder are data.
 *
 * **60182 Cop**: "Forced Interrupt: When Cop would scheme, it attacks the villain instead." An enemy-on-enemy attack
 * (`enemyAttacksEnemy`, wave 10 section 3.20): the printed ATK 2 is attack damage on the villain, with no boost card:
 * only a villain's or villainous minion's attack gets one (RRG 1.8 "Attack (Enemy Activation)" step 1, pp. 8-9), and Cop
 * is not villainous. "Would" replaces the scheme before it happens (RRG 1.8 "'Would'", p. 48).
 * When Defeated: 2 threat on the main scheme.
 * **60183 Crooked Cop**: When Defeated: the player who defeated it is dealt 1 facedown encounter card (the dealt card
 * is revealed in the next villain phase's encounter step). Boost: 2 indirect damage to the player the attack was
 * against.
 * **60184 Wanted**: Hero Action: discard from the encounter deck until a Police minion is discarded and put it into play
 * engaged with you; discard this card.
 * **60185 Police Cordon**: each Police minion in play gains guard and patrol. When Revealed: search the encounter deck
 * and discard pile for a Police minion and reveal it (the deck is shuffled after a search, RRG 1.8 "Search", p. 39).
 *
 * Cards (4):
 * - 60182 Cop (minion)
 * - 60183 Crooked Cop (minion)
 * - 60184 Wanted (obligation)
 * - 60185 Police Cordon (side_scheme)
 */
export const FNE_MODULAR_COPS: AbilityRegistry = defineAbilities({
  "60182.cop-forced-interrupt": forcedInterrupt(
    on.enemySchemes("self"),
    { would: true },
    instead(enemyAttacksEnemy(self, theVillain)),
  ),
  "60182.when-defeated": whenDefeated(placeThreat(2, theMainScheme)),

  "60183.when-defeated": whenDefeated(dealEncounterCard(defeatingPlayer)),
  "60183.boost": boost(dealIndirectDamage(you, 2)),

  "60184.obligation": heroAction(
    discardEncounterUntil(POLICE_MINION, "cop"),
    putIntoPlay(chosen("cop"), you),
    discard(self),
  ),

  "60185.police-cordon-constant": constant(
    gainsKeyword({ name: "guard" }, POLICE_MINION),
    gainsKeyword({ name: "patrol" }, POLICE_MINION),
  ),
  "60185.when-revealed": whenRevealed(
    chooseCards("cop", encounterCards(["deck", "discard"], POLICE_MINION), { min: 1, max: 1 }),
    revealCard(chosen("cop")),
    shuffleEncounterDeck(),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_COPS_SKIPPED: Readonly<Record<string, string>> = {};
