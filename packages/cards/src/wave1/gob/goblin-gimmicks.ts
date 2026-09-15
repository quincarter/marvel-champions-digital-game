import { after, boost, defineAbilities, discard, forcedResponse, heal, heroAction, ifThen, modifyAttack, not, scaled, self, spend, surge, theVillain, varAtLeast, whenRevealed, you } from "../../dsl/index.js";
import { dealIndirectDamage, isAttached, villainStageNumberOf } from "./local.js";

/**
 * Goblin Gimmicks modular set: Goblin Glider ×2 (02033, reprint of 02019), Pumpkin Bombs ×2 (02034, reprint of
 * 02021), Intimidation ×2 (02035), Regenerative Healing ×2 (02036).
 */
export const GOBLIN_GIMMICKS = defineAbilities({
  // Goblin Glider (reprint) — same shape as 02019 in mutagen-formula.ts.
  "02033.goblin-glider-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  "02033.goblin-glider-action": heroAction({ cost: spend({ energy: 2 }) }, discard(self)),

  // Pumpkin Bombs (reprint) — same shape as 02021 in mutagen-formula.ts.
  "02034.pumpkin-bombs-forced-response": forcedResponse(after.villainAttacks({ againstYou: true }), discard(self), dealIndirectDamage(2, you)),
  "02034.pumpkin-bombs-action": heroAction({ cost: spend({ physical: 2 }) }, discard(self)),

  // Intimidation — [star] Boost: Give the villain 1 additional boost card for this activation.
  "02035.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  // Regenerative Healing — When Revealed: The villain heals X damage, X = double the villain's stage number. If no
  // damage was healed this way, this card gains surge. [star] Boost: The villain heals 2 damage.
  "02036.when-revealed": whenRevealed(heal(scaled(villainStageNumberOf(theVillain), { times: 2 }), theVillain, { bind: "healed" }), ifThen(not(varAtLeast("healed.amount")), surge())),
  "02036.boost": boost(heal(2, theVillain)),
});

/**
 * Recorded skip: Intimidation's When Revealed (choose to either spend 2 resources of any type or give the villain
 * 1 facedown boost card) — the same "give the villain N facedown boost card(s)" gap as Hired Gun (`risky-
 * business.ts`): no engine primitive stockpiles a boost card onto the villain outside an activation already in
 * progress.
 */
export const GOBLIN_GIMMICKS_SKIPPED = ["02035.when-revealed"] as const;
