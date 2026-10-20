import type { AbilityRegistry } from "@mc/engine";
import {
  attacksGainKeywords,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  discard,
  each,
  enemyLeader,
  firstRevealGainsSurge,
  giveTough,
  ifThen,
  not,
  query,
  resolveWhenRevealedOf,
  surge,
  varAtLeast,
  whenRevealed,
} from "../../../dsl/index.js";

const MINION = query("minion");

/**
 * Modular set `young_avengers` (Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Toughness, Guard and Hinder 1[per_hero] are data.
 *
 * **Patriot (57055)**: When Revealed: a tough status card on the enemy leader (the villain).
 *
 * **Hawkeye (57056)**: [star] his attacks gain piercing and ranged. When Revealed: you discard an upgrade you control
 * (you choose; none: nothing).
 *
 * **Stature (57057)**: When Revealed: you discard a support you control (you choose; none: nothing).
 *
 * **Teenage Superheroes (57058)**: resolves the printed When Revealed of each minion in play, this card's revealer
 * being "you" for them. A minion's incite and surge are When Revealed abilities, resolve with its printed ones and
 * count as resolved (FFG ruling, September 22, 2026; owner decision 2026-10-20, revising docs/phase7-wave4.md §4 Q23
 * and spec M6's Citywide Crisis reading). If none resolved, this card gains surge.
 *
 * **Young Avengers (57059)**: the first minion revealed each round gains surge (anyone's reveal).
 *
 * Cards (5):
 * - 57055 Patriot (minion)
 * - 57056 Hawkeye (minion)
 * - 57057 Stature (minion)
 * - 57058 Teenage Superheroes (treachery)
 * - 57059 Young Avengers (side_scheme)
 */
export const SYNTHEZOID_MODULAR_YOUNG_AVENGERS: AbilityRegistry = defineAbilities({
  "57055.when-revealed": whenRevealed(giveTough(enemyLeader)),

  "57056.hawkeye-constant": constant(attacksGainKeywords(["piercing", "ranged"], { attacker: { self: true } })),
  "57056.when-revealed": whenRevealed(
    chooseTarget("lost", query("upgrade", { controller: "you" })),
    discard(chosen("lost")),
  ),

  "57057.when-revealed": whenRevealed(
    chooseTarget("lost", query("support", { controller: "you" })),
    discard(chosen("lost")),
  ),

  "57058.when-revealed": whenRevealed(
    resolveWhenRevealedOf(each(MINION), { bind: "revealed" }),
    ifThen(not(varAtLeast("revealed.count")), surge()),
  ),

  "57059.young-avengers-constant": constant(firstRevealGainsSurge(MINION, "round")),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_YOUNG_AVENGERS_SKIPPED: Readonly<Record<string, string>> = {};
