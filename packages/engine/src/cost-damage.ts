/**
 * "Take N indirect damage →" as an ability cost (`AbilityCost.indirectDamage`; Kinetic Armor, `sm` 27149), "Deal N
 * damage to a [chosen] character you control →" (`AbilityCost.damageCards`; Thwip Thwip!, `spdr` 31017) and "Take N
 * damage →" (`AbilityCost.damageSelf`; Focused Rage, `01027`): whether a player could take it all, and the step that
 * settles it once taken.
 *
 * RRG 1.8 "Cost" (p. 14): "If taking damage is a cost, that cost is not considered paid unless all of that damage was
 * taken. (If any of the damage is prevented, then the cost has not been paid.)" "Initiating Abilities" (p. 24) checks
 * the player's ability to pay at step 3, before anything is paid. The damage itself is assigned and dealt by the same
 * `dealIndirectDamage` effect a card's "take 3 indirect damage" effect uses, pushed above the ability's own frame by
 * `payCost`, so it resolves (with its interrupt and response windows) before the ability's effects; the RRG's
 * "Responses to the text preceding the cost arrow icon resolve before the text following the icon resolves" ("Cost
 * Arrow Icon", p. 14).
 */

import type { EngineDeps } from "./abilities.js";
import { type Ctx, emit, setFrame } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { characterProfile, getInstance, getPlayer } from "./query.js";
import { addFrameVars, type Frame } from "./resolve/frames.js";
import { cannotTakeDamage, damagePreventerOf, damageTakenAfterConstants } from "./rules.js";
import { isAlly } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";

/** The ability-frame var marking a cost that was not paid in full, so its effects do not resolve (`resolve/ability.ts`). */
export const COST_NOT_PAID_VAR = "cost.notPaid";

/**
 * How much indirect damage from `sourceId` `playerId`'s characters could take: each one's remaining hit points, their
 * identity and the allies they control, none that cannot take damage from the source (RRG 1.8 "Indirect Damage", p.
 * 24: "a character cannot be assigned more indirect damage than would cause it to be defeated"; "Characters that cannot
 * take damage cannot be assigned indirect damage").
 *
 * `excludeTough`: leave out a character holding a tough status card, whose share would all be prevented. A cost wants
 * this (the Focused Rage FAQ entry, RRG 1.8 p. 57: a cost tough would prevent cannot be paid); the thwart cost's check
 * (`thwart-cost.ts`, docs/phase7-wave5.md §4.1 Q30) does not ask for it and finds out as it is paid.
 */
export function indirectDamageCapacity(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  sourceId: InstanceId | null,
  options: { readonly excludeTough?: boolean } = {},
): number {
  const player = getPlayer(state, playerId);
  if (!player) return 0;
  const characters = [player.identity.instanceId, ...player.playArea.filter((id) => isAlly(state, id))];
  let capacity = 0;
  for (const id of characters) {
    if (cannotTakeDamage(state, deps, id, [sourceId])) continue;
    const instance = getInstance(state, id);
    if (options.excludeTough && (instance?.statuses.tough ?? 0) > 0) continue;
    const maxHp = characterProfile(state, id, deps)?.maxHp;
    if (maxHp !== undefined) capacity += Math.max(0, maxHp - (instance?.damage ?? 0));
  }
  return capacity;
}

/** The effects `payCost` pushes for a "take N indirect damage →" cost: the damage, then `settleCostDamage`. */
export function costDamageEffects(amount: number, paidFor: Frame<"ability"> | Frame<"playCard"> | null): EffectSpec[] {
  const bind = "costDamage";
  return [
    {
      kind: "dealIndirectDamage",
      to: { kind: "controller" },
      amount: { kind: "const", value: amount },
      bind,
      asCost: true,
    },
    { kind: "settleCostDamage", amount, bind, paidFor: paidFor?.frameId ?? null },
  ];
}

/**
 * Whether `id` could take all `amount` damage from `sourceId` as a cost right now (`AbilityCost.damageCards`): RRG 1.8
 * "Cost" (p. 14), a damage cost is paid only if all of it is taken. So not a character that cannot take damage from the
 * source, one a "prevent all damage" constant covers, one a constant reduction would bring short of `amount`, or one
 * holding a tough status card (the Focused Rage FAQ entry, RRG 1.8 p. 57). Damage past its remaining hit points is still
 * taken (it is then defeated), so hit points do not limit it.
 */
export function canTakeCostDamage(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  sourceId: InstanceId | null,
  amount: number,
): boolean {
  const instance = getInstance(state, id);
  if (!instance || characterProfile(state, id, deps) === undefined) return false;
  if (cannotTakeDamage(state, deps, id, [sourceId])) return false;
  if (damagePreventerOf(state, deps, id) !== null) return false;
  if (instance.statuses.tough > 0) return false;
  return damageTakenAfterConstants(state, deps, id, amount, false, undefined, { card: sourceId }) >= amount;
}

/**
 * The effects `payCost` pushes for a "deal N damage to a [chosen] character →" cost (`AbilityCost.damageCards`): the
 * damage to each picked card, bound in `slot` on the pushed frame, then `settleCostDamage` for all of it.
 */
export function pickedCostDamageEffects(
  slot: string,
  picks: number,
  amount: number,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): EffectSpec[] {
  const bind = "costDamage";
  return [
    { kind: "dealDamage", target: { kind: "slot", slot }, amount: { kind: "const", value: amount }, bind },
    { kind: "settleCostDamage", amount: amount * picks, bind, paidFor: paidFor?.frameId ?? null },
  ];
}

/**
 * The effects `payCost` pushes for a "take N damage →" cost (`AbilityCost.damageSelf`): the payer's identity takes the
 * damage (`taken`: no "that event deals N additional damage" bonus adds to it), then `settleCostDamage`. RRG 1.8 "Cost"
 * (p. 14): "If taking damage is a cost, that cost is not considered paid unless all of that damage was taken. (If any
 * of the damage is prevented, then the cost has not been paid.)" `planCost` has already refused the cost where the
 * damage would certainly be prevented (`canTakeCostDamage`; FAQ "Focused Rage (#27)", p. 57), so this catches what
 * could not be known then: an interrupt that prevents some or all of it, or gives a tough status card first.
 *
 * Not to be confused with `AbilityCost.dealDamage` (`attach-cost.ts`, Energy Transfer): "If dealing damage is a cost,
 * that cost is considered paid even if some or all of that damage is prevented" (same page), so it is never settled.
 */
export function selfCostDamageEffects(
  amount: number,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): EffectSpec[] {
  const bind = "costDamage";
  return [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: amount },
      taken: true,
      bind,
    },
    { kind: "settleCostDamage", amount, bind, paidFor: paidFor?.frameId ?? null },
  ];
}

/**
 * The `settleCostDamage` step: every point taken, the cost is paid; short of it, the frame it paid for is marked
 * (`COST_NOT_PAID_VAR`) so the ability's effects do not resolve. An event card's `playCard` frame hands its vars to
 * the ability frames it pushes, so the mark reaches them too.
 */
export function executeSettleCostDamage(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "settleCostDamage" }>,
): void {
  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  const taken = frame.vars[`${effect.bind}.amount`] ?? 0;
  const paid = taken >= effect.amount;
  emit(ctx, {
    type: "costDamageSettled",
    instanceId: frame.selfInstanceId,
    playerId: frame.controllerId,
    amount: effect.amount,
    taken,
    paid,
  });
  if (!paid) addFrameVars(ctx, effect.paidFor, { [COST_NOT_PAID_VAR]: 1 });
}
