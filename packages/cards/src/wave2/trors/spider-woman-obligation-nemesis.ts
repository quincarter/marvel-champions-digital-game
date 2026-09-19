import { chooseOne, constant, defineAbilities, exists, gets, moveCards, option, placeThreat, query, self, theMainScheme, whenRevealed } from "../../dsl/index.js";
import { engagedPlayerOf } from "../../dsl/values.js";
import { discardThisObligation } from "../../core/obligations.js";

/**
 * Uncertain Loyalties (04053), Spider-Woman's obligation (no "you may flip" line, unlike Core/wave 1's shape, so
 * `../../core/obligations.js`'s shared `obligation()` helper doesn't fit — scripted directly), and her nemesis
 * set: The Viper (04054), The Viper's Ambition (04055), Hydra Regular (04056, no ability text — Incite 1 is data).
 * Hail Hydra! (04057, and its Hydra Assault printing 04147) is a verbatim Core/wave 1 reprint (`cap` 03030) —
 * aliased by `../reprints.ts`, not scripted here.
 */
export const SPIDER_WOMAN_OBLIGATION_NEMESIS = defineAbilities({
  // Uncertain Loyalties — Give to the Jessica Drew Player.
  // • Exhaust Jessica Drew → remove Uncertain Loyalties from the game.
  // • Place 3 threat on the main scheme. Discard this obligation.
  "04053.obligation": whenRevealed(
    chooseOne(
      option(
        "Exhaust Jessica Drew → remove this obligation from the game",
        { when: exists(query("alterEgo", { controller: "you", exhausted: false })) },
        { kind: "exhaust", target: { kind: "identityOf", player: { kind: "controller" } } },
        moveCards({ kind: "ref", ref: self }, "removedFromGame"),
      ),
      option("Place 3 threat on the main scheme. Discard this obligation.", placeThreat(3, theMainScheme), discardThisObligation),
    ),
  ),

  // The Viper — While the Viper is engaged with you, your hand size is reduced by 1. (Elite, nemesis minion — data.)
  "04054.the-viper-constant": constant(gets("handSize", -1, query("identity", { controlledBy: engagedPlayerOf(self) }))),

  // The Viper's Ambition — When Revealed: Place an additional 1 [per_hero] threat here.
  "04055.when-revealed": whenRevealed(placeThreat({ kind: "perPlayer", base: 0, perPlayer: 1 }, self)),
});
