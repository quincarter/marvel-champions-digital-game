/**
 * Attaching a card to a host, the one way an ability does it: the `attach` effect (and `findCard`'s `{ attachTo }`,
 * which hands its move to that effect) and an attach cost (`AbilityCost.attach`, `attach-cost.ts`; docs/phase7-wave6.md
 * §3.49: "Find Touched and attach it to a character other than Rogue and deal 2 damage to that character →", Energy
 * Transfer, `rogue` 38007, erratum RRG 1.8 p. 69).
 *
 * RRG 1.8 "Attach To" (p. 8): the card is placed on a game element in play; "the 'attach to' phrase on a card is not
 * resolved if another ability causes that card to attach to a specific game element", so the card's own printed
 * restriction (`attachesTo`) is not read here. The host may be any card in play: an enemy, another player's identity in
 * either form, another player's ally.
 *
 * Control (RRG 1.8 "Ownership and Control", p. 31): "Cards enter play under their owner's control", and "Upgrades
 * attached to a card controlled by a player other than the upgrade's owner are controlled by that other player"
 * (`settleUpgradeControl`; owner decision 2026-10-03). An enemy, the villain or a scheme is controlled by the scenario,
 * which is not a player, so an upgrade there stays under its owner. The sentence names upgrades only, so any other card
 * attached by a player (an [Arrow] event on Hawkeye's Quiver, a facedown card under Bruno Carrelli) keeps the old rule:
 * its owner's control as it enters play, its controller kept when it moves between hosts.
 */

import { type Ctx, emit, moveCard, updateInstance } from "../ctx.js";
import type { EngineDeps } from "../abilities.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { cardOf, getInstance, mustInstance } from "../query.js";
import { canHaveAttached, cannotBeUnattached } from "../rules.js";
import { cardsInPlay, controllerOf, isFacedownAttachment } from "../select.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";

/**
 * Whether `id` can be attached to `host` now: the host is in play and is not the card itself, the card is not one that
 * "cannot be unattached" from another host (docs/phase7-wave3.md §3.19), and the host can have it attached
 * (`cannotHaveAttachments`, docs/phase7-wave4.md §3.8). A card already on that host passes: it stays where it is.
 */
export function canAttachTo(state: GameState, deps: EngineDeps, id: InstanceId, host: InstanceId): boolean {
  if (id === host || !cardsInPlay(state).includes(host)) return false;
  const instance = getInstance(state, id);
  if (!instance) return false;
  const current = instance.attachedTo;
  if (current === host) return true;
  if (current !== null && cannotBeUnattached(state, deps, id)) return false;
  return canHaveAttached(state, deps, host, id);
}

/**
 * Attaches `id` to `host` if it can (`canAttachTo`); returns whether it is on that host afterwards. A card already on
 * that host stays as it is, with no move. `facedown`: "attach 1 card from your hand facedown here" (Bruno Carrelli),
 * with no title, traits, keywords or abilities until it leaves play; otherwise it is faceup in play whatever zone it
 * came from ("search the top 5 cards of your deck for an [Arrow] event and attach it faceup to this card", Hawkeye's
 * Quiver; docs/phase7-wave2.md §3.10).
 */
export function attachCard(ctx: Ctx, id: InstanceId, host: InstanceId, facedown = false): boolean {
  if (!canAttachTo(ctx.state, ctx.deps, id, host)) return false;
  if (mustInstance(ctx.state, id).attachedTo === host) return true;
  const wasInPlay = cardsInPlay(ctx.state).includes(id);
  // An upgrade whose control came from its old host (p. 31) goes back to its owner when it moves off that host (same
  // page: a change of control lasts until "the ability that changed control of that card ceases to be in effect").
  const before = mustInstance(ctx.state, id);
  const heldByHost =
    wasInPlay &&
    before.controllerId !== before.ownerId &&
    hostedUpgradeController(ctx.state, id) === before.controllerId;
  moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
  // A minion attached to a card is in no player's play area: it "is not considered engaged with a player" (RRG 1.8 FAQ
  // "Malice (#199)", p. 64; `isAttachedMinion`).
  if (before.engagedWith !== null) updateInstance(ctx, id, (i) => ({ ...i, engagedWith: null }));
  // A player card entering play from out of play enters under its owner's control (RRG 1.8 p. 31); one moving between
  // hosts keeps its controller. A no-op for every card whose controller is already its owner.
  const { ownerId, controllerId } = mustInstance(ctx.state, id);
  if (!wasInPlay && ownerId !== null && controllerId !== ownerId)
    updateInstance(ctx, id, (i) => ({ ...i, controllerId: ownerId }));
  if (facedown) updateInstance(ctx, id, (i) => ({ ...i, faceup: false, facedownAs: { kind: "blank", traits: [] } }));
  else if (isFacedownAttachment(ctx.state, id))
    // A facedown attachment attached faceup to a host is itself again, and in play (RRG 1.8 p. 23).
    updateInstance(ctx, id, (i) => ({ ...i, faceup: true, facedownAs: null }));
  else if (!mustInstance(ctx.state, id).faceup) updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
  settleUpgradeControl(ctx, id, heldByHost ? ownerId : mustInstance(ctx.state, id).controllerId);
  return true;
}

/**
 * `attachCard`, reporting the `TriggerEvent cardAttached` to announce: one when the card landed on a host it was not on
 * before, none when it could not be attached or was already there. The caller pushes it when an ability listens.
 */
export function attachCardBy(
  ctx: Ctx,
  id: InstanceId,
  host: InstanceId,
  playerId: PlayerId | null,
  facedown = false,
): readonly TriggerEvent[] {
  const was = getInstance(ctx.state, id)?.attachedTo ?? null;
  if (!attachCard(ctx, id, host, facedown) || was === host) return [];
  return [{ kind: "cardAttached", instanceId: id, hostInstanceId: host, playerId }];
}

/**
 * RRG 1.8 "Ownership and Control" (p. 31): "Upgrades attached to a card controlled by a player other than the upgrade's
 * owner are controlled by that other player." (and "Upgrade", p. 46: "A player controls any upgrades attached to
 * characters they control, including upgrades owned by another player"). The player who controls `id` by that rule: its
 * host's controller, when `id` is a faceup player upgrade attached to a card a player controls (whoever owns that
 * card); undefined when the rule does not decide (not an upgrade, facedown, unowned, not attached, or a host no player
 * controls: an enemy, the villain, a scheme).
 */
export function hostedUpgradeController(state: GameState, id: InstanceId): PlayerId | undefined {
  const instance = getInstance(state, id);
  if (!instance || instance.attachedTo === null || instance.ownerId === null || !instance.faceup) return undefined;
  if (cardOf(state, id)?.type !== "upgrade") return undefined;
  return controllerOf(state, instance.attachedTo) ?? undefined;
}

/**
 * Gives an attached player upgrade the controller p. 31 names (`hostedUpgradeController`), or `otherwise` when the
 * rule does not decide, and logs a change as `controllerChanged` with reason `attachedTo`. Every route that attaches a
 * card calls it: `attachCard` (the `attach` effect, `findCard`'s `{ attachTo }`, an attach cost, host-to-host moves) and
 * playing an upgrade (`play-card.ts`); `applyHostedUpgradeControl` (`state-checks.ts`) keeps it true when the host
 * itself changes control ("Upgrades on a card that changes control also change control to the same new controller").
 */
export function settleUpgradeControl(ctx: Ctx, id: InstanceId, otherwise: PlayerId | null): void {
  const instance = getInstance(ctx.state, id);
  if (!instance) return;
  const to = hostedUpgradeController(ctx.state, id) ?? otherwise;
  const from = instance.controllerId;
  if (to === from) return;
  updateInstance(ctx, id, (i) => ({ ...i, controllerId: to }));
  if (to !== null) emit(ctx, { type: "controllerChanged", instanceId: id, from, to, reason: "attachedTo" });
}
