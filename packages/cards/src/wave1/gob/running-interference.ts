import {
  action,
  after,
  alterEgoAction,
  cards,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  discard,
  eachPlayer,
  forcedResponse,
  forEachPlayer,
  ifThen,
  moveCards,
  not,
  placeThreat,
  rule,
  self,
  spend,
  spendResources,
  thatPlayer,
  varAtLeast,
  whenRevealed,
  you,
  zone,
} from "../../dsl/index.js";

/**
 * Running Interference modular set: Running Interference (02046, side scheme), Tombstone (02047, minion), All Tied
 * Up (02048, attachment), Media Coverage ×2 (02049, attachment).
 */
export const RUNNING_INTERFERENCE = defineAbilities({
  // Running Interference — When Revealed: Each player must choose to either spend [mental] [physical] resources or
  // place 2 threat here.
  "02046.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      spendResources({ mental: 1, physical: 1 }, "paid", thatPlayer),
      ifThen(not(varAtLeast("paid.made")), placeThreat(2, self)),
    ),
  ),

  // Tombstone — [star] Forced Response: After Tombstone attacks and damages you, discard a [mental] or a
  // [physical] resource from your hand, if able. `TargetQuery.anyPrintedResource` (wave B primitives batch,
  // docs/phase7-wave1-scripting.md §6) is the OR over resource types this needed; `chooseCards`'s own `min: 1`
  // simply finds no candidates and skips when the hand has neither, which is "if able" (RRG "cannot" default).
  "02047.tombstone-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true, damages: true }),
    chooseCards("tossed", zone("hand", you, { filter: { anyPrintedResource: ["mental", "physical"] } }), {
      min: 1,
      max: 1,
    }),
    moveCards(cards(chosen("tossed")), "discard"),
  ),

  // All Tied Up — Attach to your identity card (data). Attached character cannot ready or change form.
  "02048.all-tied-up-constant": constant(
    rule({ kind: "cannotReady", target: { hostOfSelf: true } }),
    rule({ kind: "cannotChangeForm", player: you }),
  ),
  // Action: Spend [mental] [physical] resources → discard this card.
  "02048.all-tied-up-action": action({ cost: spend({ mental: 1, physical: 1 }) }, discard(self)),

  // Media Coverage — Attach to your identity card (data). Resolve each "When Revealed" ability that you reveal 1
  // additional time (`RuleSpec.repeatWhenRevealed`, landed against this exact card).
  "02049.media-coverage-constant": constant(rule({ kind: "repeatWhenRevealed", player: you, times: 1 })),
  // Alter-Ego Action: Spend a [mental] resource → discard this card.
  "02049.media-coverage-action": alterEgoAction({ cost: spend({ mental: 1 }) }, discard(self)),
});

/** No recorded gaps: Tombstone's Forced Response was a skip for a hand-card filter matching *either* of two
 * printed resource types in one selection until the wave B primitives batch landed `TargetQuery.anyPrintedResource`
 * (docs/phase7-wave1-scripting.md §6); it's scripted above now. */
export const RUNNING_INTERFERENCE_SKIPPED = [] as const;
