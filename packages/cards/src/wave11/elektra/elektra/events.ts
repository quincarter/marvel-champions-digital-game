import type { AbilityRegistry } from "@mc/engine";
import {
  aScheme,
  anAttackableEnemy,
  attack,
  attackAnEnemy,
  chooseNumber,
  chosen,
  countOf,
  defineAbilities,
  giveHeldBoostCard,
  heroAction,
  ifThen,
  query,
  ready,
  repeatTimes,
  shuffleTopOfSeparateDeckIntoEncounterDeck,
  thwart,
  varAtLeast,
  varOf,
  yourIdentity,
} from "../../../dsl/index.js";

const NINJA_TO_ENCOUNTER_DECK = () => shuffleTopOfSeparateDeckIntoEncounterDeck("Ninja");

/**
 * Wave 11 scripting module `elektra/elektra/events` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (4):
 * - 63006 Acrobatic Prowess (event)
 * - 63007 Killer Blow (event)
 * - 63008 Move Unseen (event)
 * - 63009 Sai Strike (event)
 *
 * **63006.acrobatic-prowess-action**: a Hero Action, so it is Elektra's hero face ("Elektra" is the hero face only,
 * ruling Oct 12, 2026 R2). She is readied, then given 1 facedown boost card she holds for her next basic power, alter-ego
 * recovery included (ruling Sep 10, 2026 R3 A).
 *
 * **63007.killer-blow-action**: "Deal up to 5 damage": the player picks 0 to 5 as the attack's damage. If the attack
 * defeats the enemy (excess damage or not) the top card of the Ninja deck is shuffled into the encounter deck.
 *
 * **63008.move-unseen-action**: "Remove up to 4 threat" (picked 0 to 4); the Ninja card is shuffled in whatever the
 * thwart did.
 *
 * **63009.sai-strike-action**: attack for 3, then one Ninja card per Elektra's Sai the player controls, each its own
 * shuffle (RRG 1.8 "'For Each'", p. 20).
 */
export const ELEKTRA_ELEKTRA_EVENTS: AbilityRegistry = defineAbilities({
  "63006.acrobatic-prowess-action": heroAction(ready(yourIdentity), giveHeldBoostCard(yourIdentity)),

  "63007.killer-blow-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    chooseNumber("damage", 5),
    attack(varOf("damage.amount"), chosen("enemy"), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), NINJA_TO_ENCOUNTER_DECK()),
  ),

  "63008.move-unseen-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    chooseNumber("threat", 4),
    thwart(varOf("threat.amount"), chosen("scheme")),
    NINJA_TO_ENCOUNTER_DECK(),
  ),

  "63009.sai-strike-action": heroAction(
    { label: "attack" },
    attackAnEnemy(3),
    repeatTimes(countOf(query("upgrade", { name: "Elektra's Sai", controller: "you" })), NINJA_TO_ENCOUNTER_DECK()),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_ELEKTRA_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
