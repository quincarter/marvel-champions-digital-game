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
  defineAbilities,
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
 * **63035 Backstab boost**: "if an enemy is activating" is read literally: a villainous Elektra's facedown boost card
 * for her own defense of an enemy attack has that enemy activating, so it deals the damage and gains no icons; only a
 * boost card with no enemy activation (her attack or thwart) gains the two icons.
 */
export const ELEKTRA_JUSTICE: AbilityRegistry = defineAbilities({
  "63035.when-revealed": whenRevealed(dealDamage(4, theVillain), surge()),
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

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_JUSTICE_SKIPPED: Readonly<Record<string, string>> = {
  "63034.when-defeated":
    "needs engine primitive: shuffle cards into the top N cards of the encounter deck (the whole deck if fewer), here the set-aside Backstab, Misdirect and Sabotage into the top 10, only if no copy of Double-Cross is in the victory display",
};
