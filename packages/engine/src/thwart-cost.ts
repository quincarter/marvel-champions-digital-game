/**
 * The additional cost to thwart a scheme (`RuleSpec additionalThwartCost`, docs/phase7-wave5.md §3.21): whether a player
 * could pay it, and how a basic thwart pays it.
 *
 * RRG 1.8 "Cost" (p. 13): "A player must pay all additional costs simultaneously with the cost that is being added to
 * [...] if they cannot pay for all of the costs at once, then they do not pay any of the costs and the effect associated
 * with the costs does not occur", and "If taking damage is a cost, that cost is not considered paid unless all of that
 * damage was taken." "Initiating Abilities" (p. 24) step 3 checks "the player's ability to pay them" before anything is
 * paid, and step 5 aborts "without paying any costs". The user's rulings (§4.1):
 *
 * - **Q18:** a player who cannot pay a scheme's additional thwart cost cannot choose that scheme as a thwart's target.
 *   Read by the basic thwart command (`basicThwartWith`, `actions.ts`) and by target validity for a "(thwart)" effect
 *   (`resolve/target-validity.ts`), so `legalActions` and every target choice agree with the engine.
 * - **Q27:** the additional cost is paid together with the thwart's own cost, and declining it undoes both. A basic
 *   thwart names its schemes in the command, so it asks for the additional cost first (`askBasicThwartCost`) and pays
 *   its own costs (the exhaust, any `basicPowerCosts`) only once that is paid (`executeSettleBasicThwartCost`).
 * - **Q28:** a thwart event's (or thwart ability's) payability is judged after its own cost is paid, at play time
 *   (`playCard`/`useAbility` check again once they have paid) as at the target choice.
 * - **Q29:** a divided basic thwart must afford the total of every chosen scheme's additional cost (`thwartCostTotal`),
 *   asked and paid once.
 * - **Q30:** a "take damage" cost that is partly prevented, or that could not all be assigned, was not paid: the
 *   thwart does not happen (for a basic thwart, with Q27's undo).
 *
 * **The fallback** is the §3.21 question as the thwart resolves (`askThwartCost`, `resolve/event.ts`), which a thwart
 * *effect* still uses: an event or ability chooses its target while it resolves, after its own cost was paid at play,
 * so there is nothing left to undo by then. Declining there, or a damage cost not fully taken, cancels that thwart
 * and its own cost stays paid. A basic thwart whose cost was paid up front is marked (`thwartCostPaid` on its event
 * frame) and is not asked again.
 */

import type { EngineDeps } from "./abilities.js";
import { commitPrepaidBasicThwart, paymentOptions, paymentsFromOptionIds, priceOrNull } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { type Ctx, createCtx, emit, setFrame } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { characterProfile, getInstance, getPlayer } from "./query.js";
import type { Frame } from "./resolve/frames.js";
import { pushEffects } from "./resolve/frames.js";
import { combineRequirements, requirementTotal, satisfies, type ResolvedRequirement } from "./resources.js";
import { cannotTakeDamage, thwartCostFor } from "./rules.js";
import { activeRules, isAlly } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";

/** A thwart's additional cost: resources to spend (null for none) and indirect damage to take. */
export interface ThwartCost {
  readonly resources: ResolvedRequirement | null;
  readonly indirectDamage: number;
}

/**
 * Every additional cost to thwart these schemes added together (§4.1 Q29: a divided basic thwart pays for all of its
 * schemes at once), or null when none of them has one.
 */
export function thwartCostTotal(
  state: GameState,
  deps: EngineDeps,
  schemeIds: readonly InstanceId[],
): ThwartCost | null {
  let any = false;
  let resources: ResolvedRequirement | null = null;
  let indirectDamage = 0;
  for (const schemeId of schemeIds) {
    const cost = thwartCostFor(state, deps, schemeId);
    if (!cost) continue;
    any = true;
    if (cost.resources !== null) resources = combineRequirements(resources ?? 0, cost.resources);
    indirectDamage += cost.indirectDamage;
  }
  return any ? { resources, indirectDamage } : null;
}

/**
 * Whether `playerId` could spend `requirement` from their hand cards and resource abilities: the same options and
 * pricing the resolution-time `spendResources` prompt uses. Overpaying is legal (RRG 1.8 "Cost", p. 13), so the
 * whole wallet is tried first, then hand cards only and each source alone (a resource ability can conflict with
 * another, as `legal.ts` allows for with its hand-only wallet). `excludeInstanceId` is a card that cannot pay (the
 * event whose "(thwart)" this is, while it is still in hand).
 */
function canSpend(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  requirement: ResolvedRequirement,
  excludeInstanceId: InstanceId | null,
): boolean {
  if (requirementTotal(requirement) === 0) return true;
  const ctx = createCtx(state, deps);
  const all = paymentsFromOptionIds(paymentOptions(ctx, playerId, excludeInstanceId, null).map((o) => o.optionId));
  const hand = all.filter((payment) => "fromHand" in payment);
  const wallets: readonly (readonly Payment[])[] = [all, hand, ...all.map((payment) => [payment])];
  return wallets.some((wallet) => {
    if (wallet.length === 0) return false;
    const pool = priceOrNull(ctx, playerId, wallet, excludeInstanceId, null);
    return pool !== null && satisfies(pool, requirement);
  });
}

/**
 * Whether `playerId` could take all of `amount` indirect damage from `sourceId`. RRG 1.8 "Indirect Damage" (p. 24):
 * it is divided among their identity and the allies they control, none assigned more than would defeat it, and none
 * that cannot take damage; what cannot be assigned is not taken, so the cost would not be paid (§4.1 Q30). The same
 * caps `dealIndirectDamage` assigns under. Whether a damage prevention will stop some of it cannot be known in
 * advance; that is found out as it is paid.
 */
function canTakeIndirect(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  sourceId: InstanceId | null,
  amount: number,
): boolean {
  const player = getPlayer(state, playerId);
  if (!player) return false;
  const characters = [player.identity.instanceId, ...player.playArea.filter((id) => isAlly(state, id))];
  let capacity = 0;
  for (const id of characters) {
    if (cannotTakeDamage(state, deps, id, [sourceId])) continue;
    const maxHp = characterProfile(state, id, deps)?.maxHp;
    if (maxHp !== undefined) capacity += Math.max(0, maxHp - (getInstance(state, id)?.damage ?? 0));
  }
  return capacity >= amount;
}

/**
 * Whether `playerId` could pay every additional cost to thwart all of `schemeIds` at once, now (true when none has
 * one). §4.1 Q29: the total, not each scheme's alone.
 */
export function thwartCostsPayable(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  schemeIds: readonly InstanceId[],
  excludeInstanceId: InstanceId | null = null,
): boolean {
  const cost = thwartCostTotal(state, deps, schemeIds);
  if (!cost) return true;
  if (cost.indirectDamage > 0 && !canTakeIndirect(state, deps, playerId, schemeIds[0] ?? null, cost.indirectDamage))
    return false;
  return cost.resources === null || canSpend(state, deps, playerId, cost.resources, excludeInstanceId);
}

/** Whether `playerId` could pay every additional cost to thwart `schemeId` now (true when it has none). */
export const thwartCostPayable = (
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  schemeId: InstanceId,
  excludeInstanceId: InstanceId | null = null,
): boolean => thwartCostsPayable(state, deps, playerId, [schemeId], excludeInstanceId);

/** Whether any additional thwart cost is in play at all (the cheap guard for the Q28 post-payment checks). */
export const anyThwartCost = (state: GameState, deps: EngineDeps): boolean =>
  activeRules(state, deps, "additionalThwartCost").length > 0;

type BasicThwart = Extract<Command, { type: "basicThwart" }>;

/**
 * §4.1 Q27: a basic thwart against schemes with an additional cost asks for it before any of its own costs are paid.
 * The question is an effects frame: spend the resources (the player may decline by paying too little or nothing),
 * then, only if they were spent, take the indirect damage; `settleBasicThwartCost` then carries out the thwart or
 * logs why not. Nothing about the thwart has happened yet — the thwarter is not exhausted, no "basic power used"
 * window has opened — so declining leaves the game as if the thwart had never been declared.
 *
 * A divided thwart asks once, for the total (§4.1 Q29); the damage's source is its first costly scheme.
 */
export function askBasicThwartCost(
  ctx: Ctx,
  command: BasicThwart,
  schemeIds: readonly InstanceId[],
  cost: ThwartCost,
): void {
  const costly = schemeIds.filter((id) => thwartCostFor(ctx.state, ctx.deps, id) !== null);
  for (const schemeInstanceId of costly)
    emit(ctx, { type: "thwartCostAsked", schemeInstanceId, playerId: command.playerId });
  const damage: EffectSpec[] =
    cost.indirectDamage > 0
      ? [
          {
            kind: "dealIndirectDamage",
            to: { kind: "controller" },
            amount: { kind: "const", value: cost.indirectDamage },
            bind: "thwartCostDamage",
          },
        ]
      : [];
  const settle: EffectSpec = {
    kind: "settleBasicThwartCost",
    command,
    schemeInstanceIds: schemeIds,
    resources: cost.resources !== null,
    indirectDamage: cost.indirectDamage,
  };
  const effects: EffectSpec[] = cost.resources
    ? [
        { kind: "spendResources", player: { kind: "controller" }, resources: cost.resources, bind: "thwartCost" },
        ...(damage.length > 0
          ? [
              {
                kind: "if" as const,
                condition: { kind: "varAtLeast" as const, name: "thwartCost.made", amount: 1 },
                then: damage,
              },
            ]
          : []),
        settle,
      ]
    : [...damage, settle];
  pushEffects(ctx, {
    effects,
    selfInstanceId: costly[0] ?? schemeIds[0] ?? null,
    controllerId: command.playerId,
  });
}

/**
 * The `settleBasicThwartCost` step (see `askBasicThwartCost`): with the resources spent and every point of the damage
 * taken, the basic thwart goes ahead, its own costs paid now (`commitPrepaidBasicThwart`); otherwise nothing of it
 * happens. Either way it is logged (`thwartCostSettled`).
 *
 * A damage cost partly paid is not paid (RRG 1.8 "Cost", p. 13; §4.1 Q30), but damage already taken stays taken, as do
 * resources spent before a damage cost fails: the RRG has no way to un-take damage, and no printed scheme has both.
 */
export function executeSettleBasicThwartCost(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "settleBasicThwartCost" }>,
): void {
  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  const { command, schemeInstanceIds } = effect;
  const settled = (outcome: "paid" | "declined" | "damageNotTaken" | "abandoned", reason?: string): void =>
    emit(ctx, {
      type: "thwartCostSettled",
      playerId: command.playerId,
      schemeInstanceIds,
      outcome,
      ...(reason ? { reason } : {}),
    });
  if (effect.resources && (frame.vars["thwartCost.made"] ?? 0) < 1) return settled("declined");
  if (effect.indirectDamage > 0 && (frame.vars["thwartCostDamage.amount"] ?? 0) < effect.indirectDamage)
    return settled("damageNotTaken");
  settled("paid");
  const error = commitPrepaidBasicThwart(ctx, command);
  if (error) settled("abandoned", error.message);
}
