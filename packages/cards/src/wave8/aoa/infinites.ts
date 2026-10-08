import type { PlayModes } from "@mc/content";
import type { AbilityRegistry, SetupOption } from "@mc/engine";
import {
  boost,
  constant,
  defineAbilities,
  each,
  forcedResponse,
  gainsKeyword,
  gets,
  named,
  on,
  perHero,
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

/** The encounter set whose presence in a game offers `infinitesGenePoolThreat`, whatever the scenario. */
export const INFINITES_SET_ID = "infinites";
/** The id the `setupOptionApplied` log entry carries. */
export const INFINITES_GENE_POOL_THREAT_OPTION = "infinites.gene-pool-threat";
export const INFINITES_GENE_POOL_THREAT_CITATION = "MC45 p. 8";
/** The most threat per player the option takes (the rulebook's highest recommendation). */
export const INFINITES_GENE_POOL_THREAT_MAX = 3;

/**
 * MC45 p. 8, "Modular Difficulty" (docs/phase7-wave8.md §2.2 step 4, §3.5, §4.1 Q1 = A: a setup control, off unless the
 * players turn it on):
 *
 *   "If players wish to modify the difficulty of a scenario while using the Infinites modular set, they may place
 *    threat on Gene Pool during setup … The amount of threat placed is up to the players as a group"
 *    » Skirmish Mode: Place 0 threat.
 *    » Standard Mode: Place 1[per_hero] threat.
 *    » Expert Mode: Place 2[per_hero] threat.
 *    » Heroic Mode: Place 3[per_hero] threat.
 *
 * `perPlayer` is the amount the players stated, 1 to 3 per player, placed on Gene Pool after it has entered play at
 * step 11 and before step 12 (`GameSetupConfig.setupOptions`). It is never read from the mode: the recommendations
 * above are `infinitesGenePoolThreatRecommendation`, which is only where a setup control starts.
 */
export function infinitesGenePoolThreat(perPlayer: number): SetupOption {
  if (!Number.isInteger(perPlayer) || perPlayer < 1 || perPlayer > INFINITES_GENE_POOL_THREAT_MAX)
    throw new Error(`Gene Pool setup threat is 1 to ${INFINITES_GENE_POOL_THREAT_MAX} per player, not ${perPlayer}`);
  return {
    option: INFINITES_GENE_POOL_THREAT_OPTION,
    amount: perPlayer,
    text: `Modular Difficulty: Place ${perPlayer}[per_hero] threat on Gene Pool.`,
    citation: INFINITES_GENE_POOL_THREAT_CITATION,
    effects: [placeThreat(perHero(perPlayer), each(query("sideScheme", { name: "Gene Pool" })))],
  };
}

/** The rulebook's recommended amount per player for the modes being played: where the setup control starts. */
export const infinitesGenePoolThreatRecommendation = (modes: PlayModes): number =>
  modes.skirmish ? 0 : modes.heroic ? 3 : modes.expert ? 2 : 1;
