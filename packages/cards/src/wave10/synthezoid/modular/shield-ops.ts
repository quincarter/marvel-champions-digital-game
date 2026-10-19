import type { AbilityRegistry } from "@mc/engine";
import {
  activatingEnemy,
  boost,
  chosen,
  constant,
  defineAbilities,
  discardEncounterUntil,
  each,
  firstRevealGainsSurge,
  giveTough,
  ifThen,
  inForm,
  placeThreat,
  query,
  statOf,
  takeDamage,
  theMainScheme,
  whenRevealed,
} from "../../../dsl/index.js";

/** "The enemy leader" outside Civil War's competitive game is the villain (ruling July 9, 2026 R3; spec M13). */
const ENEMY_LEADER = query("villain");
const MINION = query("minion");

/**
 * Modular set `shield_ops` (Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Patrol and Hinder 1[per_hero] are data.
 *
 * **S.H.I.E.L.D. Operator (57013)**: When Revealed: 2 threat on the main scheme.
 *
 * **Strategic Overwatch (57014)**: When Revealed: a tough status card on the enemy leader (the villain) and on each
 * minion. Boost: one on the activating enemy.
 *
 * **Rapid Response (57015)**: When Revealed: discard encounter cards until a minion is discarded (the match stays in
 * the discard pile). If the encounter deck empties first the search stops there, not continuing with the reshuffled
 * deck (RRG 1.8 "Encounter Deck", p. 17): nothing is bound, no threat or damage is dealt. In alter-ego form, threat
 * on the main scheme equal to that minion's SCH; in hero form, damage to your hero equal to its ATK. The minion's
 * printed stat is read as the card lies in the discard pile (no modifiers apply there).
 *
 * **Homeland Security (57016)**: the first minion revealed each round gains surge (anyone's reveal).
 *
 * Cards (4):
 * - 57013 S.H.I.E.L.D. Operator (minion)
 * - 57014 Strategic Overwatch (treachery)
 * - 57015 Rapid Response (treachery)
 * - 57016 Homeland Security (side_scheme)
 */
export const SYNTHEZOID_MODULAR_SHIELD_OPS: AbilityRegistry = defineAbilities({
  "57013.when-revealed": whenRevealed(placeThreat(2, theMainScheme)),

  "57014.when-revealed": whenRevealed(giveTough(each(ENEMY_LEADER)), giveTough(each(MINION))),
  "57014.boost": boost(giveTough(activatingEnemy)),

  "57015.when-revealed": whenRevealed(
    discardEncounterUntil(MINION, "found"),
    ifThen(
      inForm("alterEgo"),
      placeThreat(statOf(chosen("found"), "sch"), theMainScheme),
      takeDamage(statOf(chosen("found"), "atk")),
    ),
  ),

  "57016.homeland-security-constant": constant(firstRevealGainsSurge(MINION, "round")),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_SHIELD_OPS_SKIPPED: Readonly<Record<string, string>> = {};
