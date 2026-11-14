import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  anEnemy,
  anyOfCards,
  atMost,
  attackInProgress,
  cards,
  chooseCards,
  chooseOne,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  encounterCards,
  encounterSetAside,
  exhaustThis,
  forcedInterrupt,
  forcedResponse,
  gets,
  giveHeldBoostCard,
  heroAction,
  ifThen,
  instead,
  interrupt,
  modifyAttack,
  moveCards,
  not,
  on,
  option,
  query,
  reduceNextCardCost,
  removedFromGameCards,
  reorderCards,
  response,
  revealCard,
  selectCards,
  self,
  separateDeckCards,
  setAside,
  setRemainingHitPoints,
  shuffleEncounterDeck,
  varAtLeast,
  when,
  you,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../../dsl/index.js";

const ACROBATIC = trait("ACROBATIC");
const ATTACK = trait("ATTACK");

/**
 * Wave 11 scripting module `elektra/elektra/support-upgrades-allies` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (6):
 * - 63005 Daredevil (ally)
 * - 63010 Resurrection Altar (support)
 * - 63011 White Tiger (support)
 * - 63012 Elektra's Sai (upgrade)
 * - 63013 History with the Hand (upgrade)
 * - 63014 Stealth Mastery (upgrade)
 *
 * **63005.daredevil-response**: "After Daredevil uses a basic power" (`basicPowerUsed`, his own, an ally's attack or
 * thwart), the controller picks a card from the encounter discard pile and puts it on top of the encounter deck
 * (`reorderCards` moves any selected card to the top, as Hunting Shadows does for deck cards). An empty discard pile
 * does nothing.
 *
 * **63010.resurrection-altar-interrupt**: "When you would be defeated" is your identity (either form: "you" is the
 * identity, RRG 1.8 p. 49), an optional interrupt. "Remove this card from the game" is a cost, written as the first
 * replacement effect (the Ionic Physiology / Doctor Strange obligation precedent: there is no removal cost
 * part), then the hit point dial is set to 9 (`setRemainingHitPoints`, capped at her maximum, as Captain America's
 * Helmet sets 1), then her obligation is found and revealed from the same pool Loose Ends searches (the encounter deck
 * and discard pile, both set-aside areas and the removed-from-game area; RRG 1.8 "Obligation", p. 30), the encounter
 * deck shuffled after the search (p. 39).
 *
 * **63011.white-tiger-response**: "After you change to hero form" (identity change, yours). FLAG: the printed
 * "Otherwise" has no condition in front of it. Read as the only thing it can refer to: the Ninja deck gave a card
 * (`selectCards` bound, `ninja.count`), else (empty Ninja deck, nothing to shuffle in) Elektra is given 1 facedown boost
 * card for her basic powers (`giveHeldBoostCard`, ruling September 10, 2026 - Ruling 3). "Elektra" is the hero face
 * only (ruling October 12, 2026 - Ruling 2): the change just made leaves her hero face up, so her identity is
 * her.
 *
 * **63012.elektras-sai-action**: Restricted is data. 1 damage (not an attack) to an enemy, and the next Acrobatic or
 * Attack event you play this phase costs 1 less (`reduceNextCardCost`, phase). The cost reduction is the same
 * resolution as the damage, so an enemy must be available to use it.
 *
 * **63013.history-with-the-hand**: Prerequisite (hero form) and the amplify icon are data. +1 hand size for your
 * identity; the forced response discards it after any form change you make.
 *
 * **63014.stealth-mastery-forced-interrupt**: "When you attack or are attacked", one ability for both timings
 * (`on.either`): the player chooses to increase or reduce the damage by 3, then it goes on top of your deck. Your own
 * attack (`attackInProgress` with your identity as attacker) is `modifyAttack({ extraDamage: +-3 })`; an enemy attack
 * against you is `modifyAttack({ atkBonus: +-3 })` (the Herc's Helm reading of "the damage this attack deals").
 * LIMIT: `extraDamage` reduces the damage of a basic attack or of an attack event's first damage; the engine reads a
 * negative extra as 0 for later instructions of the same "(attack)" ability (`attack-ability.ts`), so a reduction does
 * not reach them.
 */
export const ELEKTRA_ELEKTRA_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "63005.daredevil-response": response(
    after.basicPowerUsed("self"),
    chooseCards("card", encounterCards(["discard"]), { min: 1, max: 1 }),
    reorderCards(cards(chosen("card"))),
  ),

  "63010.resurrection-altar-interrupt": interrupt(
    when.defeated(YOUR_IDENTITY),
    { would: true },
    instead(
      moveCards(cards(self), "removedFromGame"),
      setRemainingHitPoints(9, yourIdentity),
      selectCards(
        "obligation",
        atMost(
          1,
          anyOfCards(
            encounterCards(["deck", "discard"], { obligationOf: you }),
            setAside(you, { obligationOf: you }),
            encounterSetAside({ obligationOf: you }),
            removedFromGameCards({ obligationOf: you }),
          ),
        ),
      ),
      shuffleEncounterDeck(),
      revealCard(chosen("obligation")),
    ),
  ),

  "63011.white-tiger-response": response(
    { ...on.playerChangesForm("hero"), playerIs: "controller" },
    selectCards("ninja", separateDeckCards("Ninja", you, 1)),
    moveCards(cards(chosen("ninja")), "encounterDeckShuffle"),
    ifThen(not(varAtLeast("ninja.count")), giveHeldBoostCard(yourIdentity)),
  ),

  "63012.elektras-sai-action": heroAction(
    { cost: exhaustThis },
    anEnemy("enemy"),
    dealDamage(1, chosen("enemy")),
    reduceNextCardCost(you, 1, "phase", query("event", { anyTrait: [ACROBATIC, ATTACK] })),
  ),

  "63013.history-with-the-hand-constant": constant(gets("handSize", 1, YOUR_IDENTITY)),
  "63013.history-with-the-hand-forced-response": forcedResponse(on.youChangeForm(), discard(self)),

  "63014.stealth-mastery-forced-interrupt": forcedInterrupt(
    on.either(when.attacks(YOUR_IDENTITY), when.enemyAttacks(query("enemy"), { againstYou: true })),
    chooseOne(
      option(
        "Increase the damage by 3",
        ifThen(
          attackInProgress({ attacker: YOUR_IDENTITY }),
          modifyAttack({ extraDamage: 3 }),
          modifyAttack({ atkBonus: 3 }),
        ),
      ),
      option(
        "Reduce the damage by 3",
        ifThen(
          attackInProgress({ attacker: YOUR_IDENTITY }),
          modifyAttack({ extraDamage: -3 }),
          modifyAttack({ atkBonus: -3 }),
        ),
      ),
    ),
    moveCards(cards(self), "deckTop"),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_ELEKTRA_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
