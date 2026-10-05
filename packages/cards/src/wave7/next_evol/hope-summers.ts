import type { AbilityRegistry } from "@mc/engine";
import {
  baseStatsFromYourHero,
  constant,
  defineAbilities,
  excludedFromAllyLimit,
  exhaust,
  leavingPlayLoses,
  named,
  query,
  rule,
  whenRevealed,
} from "../../dsl/index.js";

/**
 * The Hope Summers set (40130 Hope Summers, 40131 Captive Hope; extra modular, used by the Juggernaut, Mister Sinister
 * and Stryfe scenarios).
 *
 * Hope is an encounter-backed ally with the setup keyword; the engine puts her into play at setup (Appendix II step 11)
 * and the three 1A Setups find her already there. Her three printed paragraphs are the three constants:
 *  - "The first player controls Hope Summers. [She] does not count against your ally limit." (control follows the
 *    first-player token, through an elimination; moving between play areas is not leaving or entering play)
 *  - "[star] base THW and base ATK are equal to the THW and ATK of your hero" (ruling January 17, 2026 - Ruling 1: the
 *    star is what this ability defines; owner Q14 = B: 0 while her controller is in alter-ego form)
 *  - "If Hope Summers leaves play, the players lose the game."
 */
const HOPE = query("ally", { name: "Hope Summers" });

export const HOPE_SUMMERS: AbilityRegistry = defineAbilities({
  "40130.hope-summers-constant": constant(
    rule({ kind: "controlledByFirstPlayer", target: { self: true } }),
    excludedFromAllyLimit({ self: true }),
  ),
  "40130.hope-summers-constant-2": constant(baseStatsFromYourHero()),
  "40130.hope-summers-constant-3": constant(leavingPlayLoses({ self: true })),

  // Captive Hope: every way of readying is blocked (no bySource), not only player card effects.
  "40131.captive-hope-constant": constant(rule({ kind: "cannotReady", target: HOPE })),
  "40131.when-revealed": whenRevealed(exhaust(named("Hope Summers"))),
});
