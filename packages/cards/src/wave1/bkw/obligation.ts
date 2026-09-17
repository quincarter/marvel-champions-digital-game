import { bindTargets, chooseTarget, chosen, defineAbilities, discard, exists, ifThen, surge } from "../../dsl/index.js";
import type { TargetQuery } from "@mc/engine";
import { obligation } from "../../core/obligations.js";
import { PREPARATION, theCardWithHighestCost } from "./local.js";

/** Preparation cards in play under your control (every Preparation card in this pack is an upgrade). */
const PREPARATION_YOU_CONTROL: TargetQuery = { categories: ["ally", "support", "upgrade"], trait: PREPARATION, controller: "you" };

export const BKW_OBLIGATION = defineAbilities({
  // Burn Notice (08025).
  // • Exhaust Natasha Romanoff → remove this card from the game. (Shared `obligation()` shape.)
  // • Discard the Preparation card you control with the highest cost. If you cannot, this card gains surge. Discard
  //   this obligation.
  // "The … card with the highest cost" is one card: a tie is broken by the player's own choice among the tied cards,
  // not by discarding all of them.
  "08025.obligation": obligation("Natasha Romanoff", {
    label: "Discard the Preparation card you control with the highest cost",
    effects: [
      ifThen(
        exists(PREPARATION_YOU_CONTROL),
        [bindTargets("highest", theCardWithHighestCost(PREPARATION_YOU_CONTROL)), chooseTarget("burned", { inSlot: "highest" }), discard(chosen("burned"))],
        surge(),
      ),
    ],
  }),
});

/** Every Burn Notice ability is scripted now; kept so `./index.ts`'s exports are unchanged. */
export const BKW_OBLIGATION_SKIPPED = [] as const;
