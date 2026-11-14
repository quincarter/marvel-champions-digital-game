import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  anEnemy,
  anyOfCards,
  atMost,
  cards,
  chooseCards,
  chooseOne,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  eventKindIs,
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
 * Helmet sets 1), then her obligation is found and revealed from the same pool Loose Ends searches, minus the
 * removed-from-game area: the encounter deck and discard pile and both set-aside areas (RRG 1.8 "Obligation", p. 30),
 * the encounter deck shuffled after the search (p. 39). "Find" excludes removed-from-game cards (RRG 1.8 "Find", p. 19;
 * "Removed from the Game" cards cannot re-enter); Loose Ends reaches that area only because it prints it (ruling
 * December 17, 2025 (4)). Her own obligation is never there unless this card's removal put it so, which it cannot.
 *
 * **63011.white-tiger-response**: "After you change to hero form" (identity change, yours). The printed "Otherwise" refers to the
 * preceding sentence and resolves when that sentence cannot at least partially resolve (RRG 1.8 "'Otherwise'", p. 31):
 * the Ninja deck gave a card (`selectCards` bound, `ninja.count`), else (empty Ninja deck, nothing to shuffle in) Elektra is given 1 facedown boost
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
 * (`on.either`; "you" is the identity, RRG 1.8 p. 49, so an attack on your ally does not trigger it): the player chooses to increase or reduce the damage by 3, then it goes on top of your deck. Your own
 * attack (any trigger that is not an enemy attack) is `modifyAttack({ extraDamage: +-3 })`; an enemy attack
 * against you is `modifyAttack({ atkBonus: +-3 })` (the Herc's Helm reading of "the damage this attack deals").
 * A reduction reaches every instance of an "(attack)" ability's damage that does not say "additional", each floored
 * at 0 (RRG 1.8 "Attack (Player Ability Type)", p. 10, read for a reduction as for an increase; `attack-ability.ts`).
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
    on.either(when.attacks(YOUR_IDENTITY), {
      ...when.enemyAttacks(query("enemy"), { againstYou: true }),
      youAreIdentity: true,
    }),
    chooseOne(
      option(
        "Increase the damage by 3",
        ifThen(eventKindIs("enemyAttack"), modifyAttack({ atkBonus: 3 }), modifyAttack({ extraDamage: 3 })),
      ),
      option(
        "Reduce the damage by 3",
        ifThen(eventKindIs("enemyAttack"), modifyAttack({ atkBonus: -3 }), modifyAttack({ extraDamage: -3 })),
      ),
    ),
    moveCards(cards(self), "deckTop"),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_ELEKTRA_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
