import type { AbilityRegistry } from "@mc/engine";
import {
  aScheme,
  anAttackableEnemy,
  attack,
  attackAnEnemy,
  cards,
  chooseOne,
  chosen,
  countersOn,
  dealDamage,
  sum,
  defineAbilities,
  discardDeckUntil,
  heroAction,
  query,
  ifThen,
  moveCards,
  option,
  removeCountersAmong,
  removeCountersFrom,
  scaled,
  stun,
  thwart,
  valueAtLeast,
  varOf,
  you,
  yourIdentity,
} from "../../../dsl/index.js";
import { CHI, YOUR_IDENTITY_QUERY } from "./chi.js";

/**
 * Wave 11 scripting module `iron_fist/iron-fist/events` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (4):
 * - 64002 Deep Breathing (event)
 * - 64003 Dragon Punch (event)
 * - 64004 Fists of Fury (event)
 * - 64005 The Way of Things (event)
 *
 * **64002.deep-breathing-action**: "Discard cards from the top of your deck until you discard an Iron Fist card and
 * add it to your hand." An Iron Fist card is a card of his identity set (RRG 1.8 "Identity-Specific Card", p. 23).
 * Nothing is bound when the deck runs out first (RRG 1.8 "Player Deck", p. 33), so nothing is added.
 *
 * **64003.dragon-punch-action**: "(attack): Deal 2 damage to an enemy. You may remove up to 5 chi counters from your
 * identity to deal 2 additional damage for each chi counter removed this way. If you removed at least 3 counters,
 * also stun that enemy." One attack of one damage instance (2 + 2 per chi removed), as Repulsor Blast.
 * "From your identity" works in either form (RRG 1.8 p. 23).
 *
 * **64004.fists-of-fury-action**: "(attack): Deal 1 damage to an enemy" three times. One attack ability, each
 * instruction choosing its own enemy (the same one may be chosen again); guard is checked for each enemy attacked
 * (owner ruling Q49, docs/phase7-wave8.md).
 *
 * **64005.the-way-of-things-action**: "(thwart): Remove 2 threat from a scheme. You may remove 2 chi counters from Iron
 * Fist to remove 2 threat from a scheme." The option needs 2 chi on him. The second scheme is chosen separately.
 */
export const IRON_FIST_IRON_FIST_EVENTS: AbilityRegistry = defineAbilities({
  "64002.deep-breathing-action": heroAction(
    discardDeckUntil(query([], { identitySetOf: you }), "found"),
    moveCards(cards(chosen("found")), "hand"),
  ),

  "64003.dragon-punch-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    chooseOne(
      option(
        "Remove up to 5 chi counters from your identity",
        { when: valueAtLeast(countersOn(yourIdentity, CHI), 1) },
        removeCountersAmong(CHI, 5, YOUR_IDENTITY_QUERY, { upTo: true, bind: "removed" }),
      ),
      option("Do not"),
    ),
    // One instance of 2 + 2 per chi removed: "additional" damage resolves together with the damage it adds to (RRG 1.8
    // "Additional"; FAQ Repulsor Blast #31), so a tough card stops all of it. An unbound "removed.amount" reads 0.
    attack(sum(2, scaled(varOf("removed.amount"), { times: 2 })), chosen("enemy")),
    ifThen(valueAtLeast(varOf("removed.amount"), 3), stun(chosen("enemy"))),
  ),

  "64004.fists-of-fury-action": heroAction(
    { label: "attack" },
    attackAnEnemy(1, { slot: "first" }),
    anAttackableEnemy("second"),
    dealDamage(1, chosen("second")),
    anAttackableEnemy("third"),
    dealDamage(1, chosen("third")),
  ),

  "64005.the-way-of-things-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(2, chosen("scheme")),
    chooseOne(
      option(
        "Remove 2 chi counters from Iron Fist",
        { when: valueAtLeast(countersOn(yourIdentity, CHI), 2) },
        removeCountersFrom(yourIdentity, CHI, 2),
        aScheme("second"),
        thwart(2, chosen("second")),
      ),
      option("Do not"),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const IRON_FIST_IRON_FIST_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
