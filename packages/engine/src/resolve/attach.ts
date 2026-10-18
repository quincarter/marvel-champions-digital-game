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
import { cardOf, getInstance, mustInstance, isOwnedEncounterCard } from "../query.js";
import { canHaveAttached, cannotBeUnattached } from "../rules.js";
import { cardsInPlay, controllerOf, isFacedownAttachment } from "../select.js";
import { attachmentHostCandidates } from "../attachment-hosts.js";
import { isPermanent } from "../keywords.js";
import { pushEvents } from "./frames.js";
import { heard } from "./triggers.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { shuffle } from "../rng.js";
import { sameFront } from "../hidden-reverse.js";

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
export function attachCard(ctx: Ctx, id: InstanceId, host: InstanceId, facedown = false, held = false): boolean {
  if (!canAttachTo(ctx.state, ctx.deps, id, host)) return false;
  // `held`: the host holds a minion (`isHeldMinion`, docs/phase7-wave9.md §3.21). Marked after the move, which removes
  // the mark of any earlier host (`relocateCard`); a card that is no minion, or facedown, is attached without it.
  const hold = (engagedBefore: PlayerId | null): void => {
    if (!held || facedown || cardOf(ctx.state, id)?.type !== "minion") return;
    if (mustInstance(ctx.state, id).heldMinion) return;
    updateInstance(ctx, id, (i) => ({ ...i, heldMinion: true }));
    emit(ctx, { type: "minionHeld", instanceId: id, hostInstanceId: host, engagedBefore });
  };
  if (mustInstance(ctx.state, id).attachedTo === host) {
    hold(null);
    return true;
  }
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
  // An encounter card a player owns (a Labor card) enters play under no player's control, as every encounter card does.
  const { ownerId, controllerId } = mustInstance(ctx.state, id);
  if (!wasInPlay && ownerId !== null && controllerId !== ownerId && !isOwnedEncounterCard(ctx.state, id))
    updateInstance(ctx, id, (i) => ({ ...i, controllerId: ownerId }));
  if (facedown) updateInstance(ctx, id, (i) => ({ ...i, faceup: false, facedownAs: { kind: "blank", traits: [] } }));
  else if (isFacedownAttachment(ctx.state, id))
    // A facedown attachment attached faceup to a host is itself again, and in play (RRG 1.8 p. 23).
    updateInstance(ctx, id, (i) => ({ ...i, faceup: true, facedownAs: null }));
  else if (!mustInstance(ctx.state, id).faceup) updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
  settleUpgradeControl(ctx, id, heldByHost ? ownerId : mustInstance(ctx.state, id).controllerId);
  hold(before.engagedWith);
  return true;
}

/**
 * "(Players cannot look at the reverse sides)" (`EffectSpec attach.hideReverse`; docs/phase7-wave9.md §3.54; MC55
 * p. 7): hides the other face of `id` and of every set-aside card with the same front (`sameFront`), until each flips.
 * Before they are marked, the cards of the group are shuffled among themselves: each instance takes the card id of a
 * random one of them (one shuffle on the game's seeded RNG), which is what dealing look-alike cards unseen does at the
 * table, and is why an instance's id or place says nothing of its other face. They are otherwise indistinguishable (set
 * aside, with nothing on them), so exchanging what each one is changes nothing a player could have seen.
 *
 * No-op for a card with one face, one already hidden (dealt from a group hidden earlier), or one already flipped.
 */
export function hideReverses(ctx: Ctx, id: InstanceId): void {
  const instance = getInstance(ctx.state, id);
  const card = cardOf(ctx.state, id);
  if (!instance || !card || instance.reverseHidden || instance.flipped) return;
  if (!("flipSide" in card) || card.flipSide === undefined) return;
  const alike = (other: InstanceId): boolean => {
    const otherCard = cardOf(ctx.state, other);
    const otherInstance = getInstance(ctx.state, other);
    return (
      otherCard !== undefined && otherInstance !== undefined && !otherInstance.flipped && sameFront(card, otherCard)
    );
  };
  // The card itself, wherever it is (set aside still, or in play already), and its look-alikes set aside.
  const group = [id, ...ctx.state.encounterSetAside.filter((other) => other !== id && alike(other))];
  const [cardIds, rng] = shuffle(
    group.map((member) => mustInstance(ctx.state, member).cardId),
    ctx.state.rng,
  );
  ctx.state = { ...ctx.state, rng };
  group.forEach((member, index) => {
    const cardId = cardIds[index];
    if (cardId === undefined) return;
    updateInstance(ctx, member, (i) => ({ ...i, cardId, reverseHidden: true }));
  });
  emit(ctx, { type: "reversesHidden", instanceIds: group });
}

/**
 * "Attached ally is under no player's control. (Attached ally is still in play.)" (`EffectSpec attach` with
 * `as: "captive"`; docs/phase7-wave9.md §3.19): clears the controller of an ally attached to `host`, which makes it a
 * captive ally (`isCaptiveAlly`). Nothing else on it changes (RRG 1.8 "Ownership and Control", p. 31: a character that
 * changes control "remains in the same state (i.e., readied or exhausted, damaged or not, etc.)"), and it keeps its
 * owner. An upgrade on it is on a card no player controls, so the rule that ties an upgrade's control to its host's
 * controller does not decide and the upgrade keeps its controller (`hostedUpgradeController`). No-op for a card that is
 * not an ally, is not on `host` (the attach was refused), is facedown, or already has no controller.
 */
export function releaseControlOfCaptive(ctx: Ctx, id: InstanceId, host: InstanceId): void {
  const instance = getInstance(ctx.state, id);
  if (!instance || instance.attachedTo !== host || !instance.faceup) return;
  const from = instance.controllerId;
  if (from === null || cardOf(ctx.state, id)?.type !== "ally") return;
  updateInstance(ctx, id, (i) => ({ ...i, controllerId: null }));
  emit(ctx, { type: "controlReleased", instanceId: id, hostInstanceId: host, from });
}

/**
 * `attachCard`, reporting what to announce: none when the card could not be attached or was already on that host;
 * otherwise a `TriggerEvent cardAttached`, which the caller pushes when an ability listens, preceded by a
 * `cardEntersPlay` when the attaching is how the card entered play.
 *
 * RRG 1.8 "Enters Play" (p. 18): a card enters play when it "transitions from an out-of-play area into play", by
 * whatever means, so a card attached from a deck, a discard pile, a hand, a set-aside area or as a boost card has
 * entered play: its keywords resolve (Uses places its counters, p. 46; toughness, hinder, the restricted check) as
 * that event's apply step, and "when / after … enters play" abilities answer it, exactly as for a card that
 * `putIntoPlay` attaches. The caller always pushes this one (`announcesAttaching`): its apply step is the keywords.
 * Its player is the card's controller, or the attaching player for a card nobody controls (an encounter attachment).
 *
 * Not entering play: a card already in play moved from one host to another, which keeps its counters and state
 * ("Leaves Play", p. 27, and "Enters Play" both name a change of area, and it changed none), and a card attached
 * facedown, which is out of play on its host (RRG 1.8 "In Play and Out of Play", p. 23).
 *
 * Announced elsewhere: an encounter attachment being revealed that its own When Revealed or `cannotAttach` ability
 * attaches. Its reveal announces it once that ability has resolved (`revealAnnouncesEntry`), as it always has.
 */
export function attachCardBy(
  ctx: Ctx,
  id: InstanceId,
  host: InstanceId,
  playerId: PlayerId | null,
  facedown = false,
  held = false,
): readonly TriggerEvent[] {
  const was = getInstance(ctx.state, id)?.attachedTo ?? null;
  const wasInPlay = cardsInPlay(ctx.state).includes(id);
  if (!attachCard(ctx, id, host, facedown, held) || was === host) return [];
  const attached: TriggerEvent = { kind: "cardAttached", instanceId: id, hostInstanceId: host, playerId };
  if (wasInPlay || !cardsInPlay(ctx.state).includes(id) || revealAnnouncesEntry(ctx.state, id)) return [attached];
  return [{ kind: "cardEntersPlay", instanceId: id, playerId: controllerOf(ctx.state, id) ?? playerId }, attached];
}

/**
 * Whether `id` is being revealed at a step whose end announces it entering play if it is attached by then: a
 * self-attaching attachment's When Revealed (`settleAttach`; ruling Feb 20, 2026 (4)) or its `cannotAttach` abilities
 * (`resolve/reveal.ts`).
 */
const revealAnnouncesEntry = (state: GameState, id: InstanceId): boolean =>
  state.stack.some(
    (frame) =>
      frame.kind === "reveal" &&
      frame.instanceId === id &&
      (frame.stage === "settleAttach" || frame.stage === "cannotAttach"),
  );

/**
 * Which of `attachCardBy`'s events go on the stack: a card entering play always (its apply step places its keywords'
 * counters), `cardAttached` only when `heard` says an ability answers it, so an attach nobody hears logs no more than
 * the move.
 */
export const announcesAttaching = (event: TriggerEvent, heard: (event: TriggerEvent) => boolean): boolean =>
  event.kind === "cardEntersPlay" || heard(event);

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

/**
 * The host a permanent encounter attachment goes to when it becomes unattached (docs/phase7-wave10.md §3.19). MC56
 * p. 20: "When an attachment with the permanent keyword becomes unattached, resolve its 'attach to' text." (Cap's
 * Shield, `cw` 56143: "Permanent. Attach to Captain America."); RRG 1.8 "Permanent" (p. 32): it cannot leave play, so
 * the host's leaving does not take it. The printed instruction is read as a reveal reads it (`attachmentHostCandidates`;
 * RRG 1.8 "Attach To", p. 8: "checked for legality when the card would be attached"), never onto the host that is
 * leaving. Null for any other card (a player's permanent card is unattached in play, docs/phase7-wave5.md §3.30; a
 * card with no "attach to" text, or with a player owner or controller) and when the instruction names no legal host.
 *
 * Several legal hosts would be the first player's choice (RRG 1.8 "First Player", p. 19); the first in stable order is
 * taken, as player elimination has always done. No printed permanent attachment names more than one.
 */
export function permanentRehostFor(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  leavingHostId: InstanceId | null,
  playerCards = false,
): InstanceId | null {
  const instance = getInstance(state, id);
  if (!instance) return null;
  const owned = instance.ownerId !== null || instance.controllerId !== null;
  const card = state.cardPool[instance.cardId];
  // `playerCards`: a player's permanent upgrade whose host leaves play resolves its printed "attach to" too (RRG 1.8
  // "Permanent", p. 32; #238). Player elimination does not pass it: that player's cards leave the game with them.
  if (owned && !playerCards) return null;
  if ((card?.type !== "upgrade" && card?.type !== "attachment") || card.type !== (owned ? "upgrade" : "attachment"))
    return null;
  if (card.attachesTo === undefined) return null;
  if (isFacedownAttachment(state, id) || !isPermanent(state, id, deps)) return null;
  const controllerId = instance.controllerId ?? instance.ownerId;
  const context = { selfInstanceId: id, controllerId, event: null, bindings: {}, deps };
  const [host] = attachmentHostCandidates(state, card.attachesTo, context).filter(
    (candidate) => candidate !== leavingHostId && candidate !== id && canAttachTo(state, deps, id, candidate),
  );
  return host ?? null;
}

/**
 * Re-resolves a permanent encounter attachment's "attach to" as its host leaves play or its player is eliminated
 * (`permanentRehostFor`): the card moves to that host without leaving play, keeping what is on it, and the attaching
 * is announced (`cardAttached`), so "After Cap's Shield is attached to Captain America, give him a tough status
 * card" answers it. Returns whether it moved; false leaves the card where it was, for the caller's fallback.
 */
export function rehostPermanentAttachment(
  ctx: Ctx,
  id: InstanceId,
  leavingHostId: InstanceId | null,
  playerCards = false,
): boolean {
  const host = permanentRehostFor(ctx.state, ctx.deps, id, leavingHostId, playerCards);
  if (host === null) return false;
  const from = getInstance(ctx.state, id)?.attachedTo ?? null;
  const events = attachCardBy(ctx, id, host, null);
  if (getInstance(ctx.state, id)?.attachedTo !== host) return false;
  emit(ctx, { type: "permanentAttachmentRehosted", instanceId: id, fromInstanceId: from, hostInstanceId: host });
  const announced = events.filter((event) => announcesAttaching(event, (e) => heard(ctx.state, ctx.deps, e)));
  if (announced.length > 0) pushEvents(ctx, announced);
  return true;
}
