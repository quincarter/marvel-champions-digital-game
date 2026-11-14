import { cardId } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  activatingEnemy,
  adjustBoostCount,
  anEnemy,
  boost,
  chooseTarget,
  chosen,
  confuse,
  dealDamage,
  anyOfCards,
  defineAbilities,
  encounterSetAside,
  moveCards,
  not,
  valueAtLeast,
  victoryDisplayCount,
  whenDefeated,
  heal,
  ifThen,
  query,
  refMatches,
  removeThreat,
  stun,
  surge,
  theMainScheme,
  theVillain,
  whenRevealed,
} from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/justice` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (4):
 * - 63034 Double-Cross (player_side_scheme)
 * - 63035 Backstab (treachery)
 * - 63036 Misdirect (treachery)
 * - 63037 Sabotage (treachery)
 *
 * Linked (Double-Cross) is data (the engine sets the three treacheries aside when a deck has Double-Cross).
 *
 * **63034 Double-Cross when defeated**: Victory 0 is data. The When Defeated ability resolves with the card still in
 * play (RRG 1.8 "When Defeated Abilities", p. 48), so "already a copy … in the victory display" is another copy put
 * there by an earlier defeat. Then one set aside copy of each treachery is shuffled into the top 10 cards of the
 * encounter deck (`moveCards.encounterTop`; the whole deck when it holds fewer). One copy of each, not every set-aside
 * copy: the engine sets aside one set per deck with Double-Cross (RRG 1.8 "Linked", p. 27), and the victory display
 * check exists to stop a second Double-Cross shuffling in a second set, so one defeat brings in one set (engine
 * reading, authority step 5: no ruling names the multi-deck case).
 *
 * **63035 Backstab boost**: "if an enemy is activating" is read literally: a villainous Elektra's facedown boost card
 * for her own defense of an enemy attack has that enemy activating, so it deals the damage and gains no icons; only a
 * boost card with no enemy activation (her attack or thwart) gains the two icons.
 */
const BACKSTAB = "63035";
const MISDIRECT = "63036";
const SABOTAGE = "63037";
const LINKED = [BACKSTAB, MISDIRECT, SABOTAGE].map((code) =>
  encounterSetAside(query([], { printedId: cardId(code) }), { random: 1 }),
);

export const ELEKTRA_JUSTICE: AbilityRegistry = defineAbilities({
  "63034.when-defeated": whenDefeated(
    ifThen(
      not(valueAtLeast(victoryDisplayCount(query([], { printedId: cardId("63034") })), 1)),
      moveCards(anyOfCards(...LINKED), "encounterDeckShuffle", undefined, { encounterTop: 10 }),
    ),
  ),

  "63035.when-revealed": whenRevealed(dealDamage(4, theVillain), surge()),
  // "An enemy" = villain or minion (RRG 1.8 "Enemy" p. 18); a hero/ally basic power is not an enemy activation (p. 6).
  // Elektra's defend-time flip is during the villain's activation (ruling Sep 10, 2026 - Ruling 3).
  "63035.boost": boost(
    ifThen(refMatches(activatingEnemy, query("enemy")), dealDamage(2, activatingEnemy), adjustBoostCount(2)),
  ),

  "63036.when-revealed": whenRevealed(
    chooseTarget("identity", query("identity")),
    heal(4, chosen("identity")),
    surge(),
  ),
  "63036.boost": boost(anEnemy(), stun(chosen("enemy"))),

  "63037.when-revealed": whenRevealed(removeThreat(3, theMainScheme), surge()),
  "63037.boost": boost(anEnemy(), confuse(chosen("enemy"))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_JUSTICE_SKIPPED: Readonly<Record<string, string>> = {};
