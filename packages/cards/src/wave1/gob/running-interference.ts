import { action, alterEgoAction, constant, defineAbilities, discard, eachPlayer, forEachPlayer, ifThen, not, placeThreat, rule, self, spend, spendResources, thatPlayer, varAtLeast, whenRevealed, you } from "../../dsl/index.js";

/**
 * Running Interference modular set: Running Interference (02046, side scheme), Tombstone (02047, minion), All Tied
 * Up (02048, attachment), Media Coverage ×2 (02049, attachment).
 */
export const RUNNING_INTERFERENCE = defineAbilities({
  // Running Interference — When Revealed: Each player must choose to either spend [mental] [physical] resources or
  // place 2 threat here.
  "02046.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, spendResources({ mental: 1, physical: 1 }, "paid", thatPlayer), ifThen(not(varAtLeast("paid.made")), placeThreat(2, self))),
  ),

  // All Tied Up — Attach to your identity card (data). Attached character cannot ready or change form.
  "02048.all-tied-up-constant": constant(rule({ kind: "cannotReady", target: { hostOfSelf: true } }), rule({ kind: "cannotChangeForm", player: you })),
  // Action: Spend [mental] [physical] resources → discard this card.
  "02048.all-tied-up-action": action({ cost: spend({ mental: 1, physical: 1 }) }, discard(self)),

  // Media Coverage — Attach to your identity card (data). Resolve each "When Revealed" ability that you reveal 1
  // additional time (`RuleSpec.repeatWhenRevealed`, landed against this exact card).
  "02049.media-coverage-constant": constant(rule({ kind: "repeatWhenRevealed", player: you, times: 1 })),
  // Alter-Ego Action: Spend a [mental] resource → discard this card.
  "02049.media-coverage-action": alterEgoAction({ cost: spend({ mental: 1 }) }, discard(self)),
});

/**
 * Recorded skip: Tombstone's Forced Response ("discard a [mental] or a [physical] resource from your hand, if
 * able") needs a hand-card filter matching *either* of two printed resource types in one selection — `TargetQuery.
 * printedResource` only takes a single resource type, and `CardSelector`/`TargetQuery` have no "match any of these
 * categories" composition (the same shape as the documented "no anyTrait" gap, generalized to resource types).
 */
export const RUNNING_INTERFERENCE_SKIPPED = ["02047.tombstone-forced-response"] as const;
