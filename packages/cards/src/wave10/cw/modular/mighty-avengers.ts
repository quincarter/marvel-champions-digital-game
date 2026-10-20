import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  boost,
  constant,
  dealDamage,
  defineAbilities,
  each,
  enemyLeader,
  gainsKeywordsOf,
  giveTough,
  ifThen,
  not,
  placeThreat,
  query,
  resolveWhenRevealedOf,
  surge,
  theMainScheme,
  varAtLeast,
  whenRevealed,
  yourIdentity,
} from "../../../dsl/index.js";

const AVENGER_MINION = query("minion", { trait: trait("AVENGER") });

/**
 * Modular encounter set `mighty_avengers` (Civil War, Registration side; docs/phase7-wave10.md sections 3.9, 3.12 and
 * 3.23). Toughness, Teamwork (Avenger), Retaliate 1, Hinder 1[per_hero] and the boost stars and icons are data.
 *
 * **Yellowjacket (56073)**: the title is the erratum's (RRG 1.8 p. 70; the data has the current title). It shares its
 * title with the ally 56019, but the ally prints a subtitle and the minion does not, so neither blocks the other under
 * the unique rule (RRG 1.8 "Unique Icon", pp. 45-46). When Revealed and Boost: the enemy leader is given a tough
 * status card.
 *
 * **Wasp (56074)**: 1 threat on the main scheme, revealed or as a boost card. Teamwork is data.
 *
 * **U.S. Agent (56075)**: 1 damage to your identity, revealed or as a boost card (the activated player's, as a boost).
 *
 * **Mighty Avengers (56076)**: When Revealed resolves the When Revealed ability of each minion in play, and counts how
 * many resolved; with none, the card gains surge. A minion's incite and surge are When Revealed abilities and count
 * as resolved (FFG ruling, September 22, 2026; owner decision 2026-10-20, revising docs/phase7-wave4.md §4 Q23);
 * other keywords (Toughness) are not, and do not count.
 *
 * **Earth's Mightiest Heroes (56077)**: each Avenger minion gains the printed keywords of each other Avenger minion
 * (docs/phase7-wave10.md section 3.12): Retaliate 1 is live at once; Toughness, Quickstrike and
 * Teamwork only act as a minion enters play.
 *
 * Cards (5):
 * - 56073 Yellowjacket (minion)
 * - 56074 Wasp (minion)
 * - 56075 U.S. Agent (minion)
 * - 56076 Mighty Avengers (treachery)
 * - 56077 Earth's Mightiest Heroes (side_scheme)
 */
export const MODULAR_MIGHTY_AVENGERS: AbilityRegistry = defineAbilities({
  "56073.when-revealed": whenRevealed(giveTough(enemyLeader)),
  "56073.boost": boost(giveTough(enemyLeader)),

  "56074.when-revealed": whenRevealed(placeThreat(1, theMainScheme)),
  "56074.boost": boost(placeThreat(1, theMainScheme)),

  "56075.when-revealed": whenRevealed(dealDamage(1, yourIdentity)),
  "56075.boost": boost(dealDamage(1, yourIdentity)),

  "56076.when-revealed": whenRevealed(
    resolveWhenRevealedOf(each(query("minion")), { bind: "revealed" }),
    ifThen(not(varAtLeast("revealed.count")), surge()),
  ),

  "56077.earths-mightiest-heroes-constant": constant(gainsKeywordsOf(AVENGER_MINION, AVENGER_MINION)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const MODULAR_MIGHTY_AVENGERS_SKIPPED: Readonly<Record<string, string>> = {};
