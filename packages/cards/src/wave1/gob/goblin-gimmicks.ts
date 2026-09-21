import {
  after,
  boost,
  defineAbilities,
  discard,
  forcedResponse,
  giveBoostCard,
  heal,
  heroAction,
  ifThen,
  made,
  modifyAttack,
  not,
  scaled,
  self,
  spend,
  spendResources,
  surge,
  theVillain,
  varAtLeast,
  whenRevealed,
  you,
} from "../../dsl/index.js";
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
  "02034.pumpkin-bombs-forced-response": forcedResponse(
    after.villainAttacks({ againstYou: true }),
    discard(self),
    dealIndirectDamage(2, you),
  ),
  "02034.pumpkin-bombs-action": heroAction({ cost: spend({ physical: 2 }) }, discard(self)),

  // Intimidation — When Revealed: Choose to either spend 2 resources of any type or give the villain 1 facedown
  // boost card. "Any type" is `{ generic: 2 }` (`ResourceRequirement`, `packages/engine/src/resources.ts`) — a
  // requirement not tied to a specific resource color. `spendResources` asks the revealing player for payment and
  // sets `<bind>.made`; declining (or paying too little) falls through to the alternative.
  "02035.when-revealed": whenRevealed(
    spendResources({ generic: 2 }, "spent"),
    ifThen(not(made("spent")), giveBoostCard()),
  ),
  // [star] Boost: Give the villain 1 additional boost card for this activation. Not `giveBoostCard`: this is "for
  // this activation" (`modifyAttack.extraBoostCards`), the validator-enforced distinction `giveBoostCard`'s own doc
  // comment names.
  "02035.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  // Regenerative Healing — When Revealed: The villain heals X damage, X = double the villain's stage number. If no
  // damage was healed this way, this card gains surge. [star] Boost: The villain heals 2 damage.
  "02036.when-revealed": whenRevealed(
    heal(scaled(villainStageNumberOf(theVillain), { times: 2 }), theVillain, { bind: "healed" }),
    ifThen(not(varAtLeast("healed.amount")), surge()),
  ),
  "02036.boost": boost(heal(2, theVillain)),
});

/** No recorded gaps: Intimidation's When Revealed was a skip for the same "give the villain a facedown boost card
 * outside an activation" gap as Hired Gun (`risky-business.ts`) until the wave B primitives batch landed
 * `giveBoostCard` (docs/phase7-wave1-scripting.md §6); it's scripted above now. */
export const GOBLIN_GIMMICKS_SKIPPED = [] as const;
