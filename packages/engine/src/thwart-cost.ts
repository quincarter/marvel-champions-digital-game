/**
 * Whether a player could pay a scheme's additional thwart cost right now (`RuleSpec additionalThwartCost`,
 * docs/phase7-wave5.md §3.21, §4.1 Q18). RRG 1.8 "Cost" (p. 13): "if they cannot pay for all of the costs at once,
 * then they do not pay any of the costs and the effect associated with the costs does not occur", and "Initiating
 * Abilities" (p. 24) step 3 checks "the player's ability to pay them" before anything is paid. The user's ruling
 * (Q18): a player who cannot pay a scheme's additional thwart cost cannot choose that scheme as a thwart's target.
 *
 * Read by the basic thwart command (`basicThwartPaying`) and by target validity for a "(thwart)" effect
 * (`resolve/target-validity.ts`), so `legalActions` and every target choice agree with the engine. The cost itself is
 * still paid as the thwart is about to resolve (`askThwartCost`, `resolve/event.ts`).
 */

import type { EngineDeps } from "./abilities.js";
import { paymentOptions, paymentsFromOptionIds, priceOrNull } from "./actions.js";
import type { Payment } from "./commands.js";
import { createCtx } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { getPlayer } from "./query.js";
import { requirementTotal, satisfies, type ResolvedRequirement } from "./resources.js";
import { cannotTakeDamage, thwartCostFor } from "./rules.js";
import { isAlly } from "./select.js";
import type { GameState } from "./state.js";

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
 * Whether some character `playerId` could assign indirect damage to can take damage from `schemeId` (RRG 1.8
 * "Indirect Damage", p. 24: their identity and the allies they control). RRG 1.8 "Cost" (p. 13): a "take damage" cost
 * is paid only if all of it is taken; whether a damage prevention will stop it cannot be known in advance, so only a
 * `cannotTakeDamage` rule makes it unpayable here.
 */
function canTakeIndirect(state: GameState, deps: EngineDeps, playerId: PlayerId, schemeId: InstanceId): boolean {
  const player = getPlayer(state, playerId);
  if (!player) return false;
  const characters = [player.identity.instanceId, ...player.playArea.filter((id) => isAlly(state, id))];
  return characters.some((id) => !cannotTakeDamage(state, deps, id, [schemeId]));
}

/** Whether `playerId` could pay every additional cost to thwart `schemeId` now (true when it has none). */
export function thwartCostPayable(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  schemeId: InstanceId,
  excludeInstanceId: InstanceId | null = null,
): boolean {
  const cost = thwartCostFor(state, deps, schemeId);
  if (!cost) return true;
  if (cost.indirectDamage > 0 && !canTakeIndirect(state, deps, playerId, schemeId)) return false;
  return cost.resources === null || canSpend(state, deps, playerId, cost.resources, excludeInstanceId);
}
