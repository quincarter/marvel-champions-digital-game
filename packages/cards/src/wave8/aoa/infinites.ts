import type { AbilityRegistry } from "@mc/engine";
import {
  boost,
  constant,
  defineAbilities,
  forcedResponse,
  gainsKeyword,
  gets,
  named,
  on,
  placeThreat,
  query,
  self,
  threatOn,
  valueAtLeast,
  whenRevealed,
} from "../../dsl/index.js";

const GENE_POOL = named("Gene Pool");
const THIS_MINION = query("minion", { self: true });

/**
 * Modular encounter set `infinites` (Age of Apocalypse, docs/phase7-wave8.md §2.2, §3.3, §3.4, §8.4). Every card is
 * existing vocabulary.
 *
 * Infinite Soldier's three tiers are cumulative constants read live (RRG "Ability", p. 4), so each turns off when
 * threat leaves Gene Pool. Its self-granted quickstrike and surge are read at its own reveal (§3.3). Gene Pool is
 * Permanent and Setup (data): it starts in play with 4 threat and is never defeated.
 *
 * Cards (3):
 * - 45069 Infinite Soldier (minion)
 * - 45070 Culling the Weak (treachery)
 * - 45071 Gene Pool (side_scheme)
 */
export const INFINITES: AbilityRegistry = defineAbilities({
  // Infinite Soldier — If the amount of threat on Gene Pool is at least: 3 — this minion gains quickstrike.
  "45069.infinite-soldier-constant": constant(
    gainsKeyword({ name: "quickstrike" }, THIS_MINION, { while: valueAtLeast(threatOn(GENE_POOL), 3) }),
  ),
  // 6 — this minion also gains surge.
  "45069.infinite-soldier-constant-2": constant(
    gainsKeyword({ name: "surge" }, THIS_MINION, { while: valueAtLeast(threatOn(GENE_POOL), 6) }),
  ),
  // 9 — this minion also gets +3 hit points.
  "45069.infinite-soldier-constant-3": constant(
    gets("hp", 3, THIS_MINION, { while: valueAtLeast(threatOn(GENE_POOL), 9) }),
  ),

  // Culling the Weak — When Revealed: place 4 threat on Gene Pool. [star] Boost: place 2 threat on Gene Pool.
  "45070.when-revealed": whenRevealed(placeThreat(4, GENE_POOL)),
  "45070.boost": boost(placeThreat(2, GENE_POOL)),

  // Gene Pool — Forced Response: after an ally is defeated by anything other than consequential damage, place 3 threat
  // here (wave 6 §3.57: consequential damage is the ally's own, from an attack or a thwart).
  "45071.gene-pool-forced-response": forcedResponse(
    on.defeated(query("ally"), { consequential: false }),
    placeThreat(3, self),
  ),
});
