/**
 * "Attached villain attacks you →" as an ability cost (`AbilityCost.enemyAttack`; docs/phase7-wave7.md §3.19 (b)):
 * whether it can be paid, and the steps that pay it.
 *
 * The attack is the same `enemyAttack` effect a card's "the villain attacks you" uses, pushed by `payCost` above the
 * frame it pays for (the indirect-damage cost's pattern, `cost-damage.ts`), so the whole enemy-attack procedure (boost
 * card, defender, boost abilities, damage, and the "after [enemy] attacks" abilities of step 6; RRG 1.8 "Attack (Enemy
 * Activation)", pp. 8–9) resolves before that frame's effects: "Nonbolded text before the cost arrow icon must be paid
 * and/or resolved in full before the text after the cost arrow icon can be resolved", and "Responses to the text
 * preceding the cost arrow icon resolve before the text following the icon resolves" (RRG 1.8 "Cost Arrow Icon", p. 14).
 */

import type { AbilityCost, EngineDeps } from "./abilities.js";
import { COST_NOT_PAID_VAR } from "./cost-damage.js";
import { type Ctx, emit, setFrame } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { statusActive } from "./keywords.js";
import { characterProfile, getPlayer, villainOf } from "./query.js";
import { addFrameVars, type Frame } from "./resolve/frames.js";
import { cannotActivate } from "./rules.js";
import { cardsInPlay, categoriesOf, type EffectContext, resolveRef } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { Bindings } from "./stack.js";
import type { GameState } from "./state.js";

type EnemyAttackCost = NonNullable<AbilityCost["enemyAttack"]>;

/** The slot the attacking enemy is bound to on the step `payCost` pushes, and the prefix its attack reports under. */
const ENEMY_SLOT = "_costAttackEnemy";
const BIND = "costAttack";

/** The enemy the cost names: the first card its ref resolves to, read with the cost's own picks bound. */
export function enemyAttackCostEnemy(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: EnemyAttackCost,
  bindings: Bindings,
): InstanceId | null {
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings, deps };
  return resolveRef(state, cost.enemy, context)[0] ?? null;
}

/**
 * Why `enemyId` could not attack `playerId` right now, or null if it could (owner decision, docs/phase7-wave7.md §4.1
 * Q13 = B: the ability cannot be triggered while the enemy could not attack). RRG 1.8 "Cost" (p. 13) has a cost paid
 * in full or not at all, and each case here is one where the `enemyAttack` effect would make no attack:
 *
 * - the enemy is not an enemy in play, its villain is defeated, or the player is eliminated;
 * - it "cannot activate" (`RuleSpec cannotActivate`; RRG 1.8 "'Cannot'", p. 11);
 * - it is stunned: "If a stunned villain or minion would attack, discard the stunned status card instead. As the
 *   attack … was replaced by the removal of the stunned status card, that character is not considered to have
 *   attacked" (RRG 1.8 "Stun, Stunned", p. 41). The stun is therefore not spent by an attempt to pay (the Focused Rage
 *   FAQ entry's reasoning, RRG 1.8 p. 57: a cost cannot be attempted just to remove a status card). A steady enemy is
 *   stunned only with two stunned status cards (`statusActive`);
 * - its ATK is a dash, which skips the activation (`dashedStatSkipsActivation`).
 *
 * The payer's form is not checked: an ability can make an enemy attack an alter-ego (RRG 1.8 "Attack (Enemy
 * Activation)", p. 8), and the "Hero Action" label is what requires hero form.
 */
export function enemyAttackCostFault(
  state: GameState,
  deps: EngineDeps,
  enemyId: InstanceId | null,
  playerId: PlayerId,
): string | null {
  if (enemyId === null || !cardsInPlay(state).includes(enemyId) || !categoriesOf(state, enemyId).includes("enemy"))
    return "no enemy in play to make this cost's attack";
  if (villainOf(state, enemyId)?.defeated) return "the enemy is defeated";
  const player = getPlayer(state, playerId);
  if (!player || player.eliminated) return "no player for the enemy to attack";
  if (cannotActivate(state, deps, enemyId)) return "the enemy cannot activate";
  if (statusActive(state, enemyId, "stunned", deps)) return "the enemy is stunned and would not attack";
  if (characterProfile(state, enemyId, deps)?.missing.includes("atk")) return "the enemy has no ATK to attack with";
  return null;
}

/** The steps `payCost` pushes for the cost, above `paidFor`: the attack by the enemy bound in `bindings`, then its settling. */
export function enemyAttackCostEffects(
  enemyId: InstanceId,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): { readonly effects: EffectSpec[]; readonly bindings: Bindings } {
  return {
    effects: [
      { kind: "enemyAttack", enemies: { kind: "slot", slot: ENEMY_SLOT }, against: { kind: "controller" }, bind: BIND },
      { kind: "settleEnemyAttackCost", enemy: enemyId, bind: BIND, paidFor: paidFor?.frameId ?? null },
    ],
    bindings: { [ENEMY_SLOT]: [enemyId] },
  };
}

/**
 * The `settleEnemyAttackCost` step: the attack was made (`<bind>.made`, reported by the attack's event frame), the
 * cost is paid; otherwise the frame it paid for is marked (`COST_NOT_PAID_VAR`) so the ability's effects do not
 * resolve.
 *
 * - **An attack another player defends is still the attack** (RRG 1.8 "Attack (Enemy Activation)", p. 8: the defending
 *   player "becomes the new target of that attack"; the first player is "still considered attacked"), so the cost is
 *   paid whoever takes the damage, and however much of it is prevented.
 * - **A canceled attack does not pay** (engine reading). RRG 1.8 "Cost Arrow Icon" (p. 14) wants the text before the
 *   arrow "paid and/or resolved in full"; "Cancel" (p. 11): "the canceled effect is not considered to have occurred";
 *   "Stun, Stunned" (p. 41) says the same of an attack a stun replaced. The same holds for an attack that ends as it is
 *   initiated because the attacker left play (RRG 1.8 "Activation", p. 6). Whatever else of the cost was paid stays
 *   paid.
 */
export function executeSettleEnemyAttackCost(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "settleEnemyAttackCost" }>,
): void {
  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  const paid = (frame.vars[`${effect.bind}.made`] ?? 0) > 0;
  emit(ctx, {
    type: "enemyAttackCostSettled",
    instanceId: frame.selfInstanceId,
    playerId: frame.controllerId,
    enemyInstanceId: effect.enemy,
    paid,
  });
  if (!paid) addFrameVars(ctx, effect.paidFor, { [COST_NOT_PAID_VAR]: 1 });
}
