import { anyIn, bindTargets, chooseTarget, chosen, defineAbilities, discard, ifThen, surge } from "../../dsl/index.js";
import type { TargetQuery } from "@mc/engine";
import { obligation } from "../../core/obligations.js";
import { PREPARATION, theCardWithHighestCost } from "./local.js";

/** Preparation cards in play under your control (every Preparation card in this pack is an upgrade). */
const PREPARATION_YOU_CONTROL: TargetQuery = {
  categories: ["ally", "support", "upgrade"],
  trait: PREPARATION,
  controller: "you",
};

/** The highest-cost of them that can leave play: "If you cannot" reads the same pool (RRG 1.8 "Permanent", p. 32). */
const HIGHEST_COST_PREPARATION = theCardWithHighestCost(PREPARATION_YOU_CONTROL, { leavesPlay: true });

export const BKW_OBLIGATION = defineAbilities({
  // Burn Notice (08025).
  // • Exhaust Natasha Romanoff → remove this card from the game. (Shared `obligation()` shape.)
  // • Discard the Preparation card you control with the highest cost. If you cannot, this card gains surge. Discard
  //   this obligation.
  // "The … card with the highest cost" is one card: a tie is broken by the obligation's player among the tied cards,
  // not by discarding all of them.
  "08025.obligation": obligation("Natasha Romanoff", {
    label: "Discard the Preparation card you control with the highest cost",
    effects: [
      ifThen(
        anyIn(HIGHEST_COST_PREPARATION),
        [
          bindTargets("highest", HIGHEST_COST_PREPARATION),
          // RRG 1.8 "Obligation" p.30 / "Ability" p.4: the obligation's player decides how to resolve it (specific over "First Player" p.19).
          chooseTarget("burned", { inSlot: "highest" }),
          discard(chosen("burned")),
        ],
        surge(),
      ),
    ],
  }),
});

/** Every Burn Notice ability is scripted now; kept so `./index.ts`'s exports are unchanged. */
export const BKW_OBLIGATION_SKIPPED = [] as const;
