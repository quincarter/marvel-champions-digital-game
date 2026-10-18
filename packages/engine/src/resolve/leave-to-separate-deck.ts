/**
 * A card leaving play placed on the bottom of its owner's separate deck instead (`EffectSpec replaceLeaveDestination`
 * with `to: { separateDeck, at: "bottom" }`, docs/phase7-wave11.md §3.3): 60001a/b "Forced Interrupt: When a Sense
 * upgrade would leave play, place it on the bottom of the Sense deck instead."
 *
 * RRG 1.8 "Leaves Play" (p. 27): only where the card goes is replaced, so it still left play, and a defeated card was
 * still defeated. RRG 1.8 "'Would'" (p. 48): a move already replaced leaves a second replacement nothing to replace.
 * A cost that discards the card is still paid: the leaving happens, only its destination changes (RRG 1.8 FAQ "Rocket
 * Raccoon (#29A)", p. 61, as `discardFromPlayDestination` reads it; ruling August 3, 2026 R1).
 */

import { type Ctx, emit, findFrame, setFrame, updateInstance } from "../ctx.js";
import { leavePlay, leavePlayAtOnce, permanentStopsLeaving } from "../effects.js";
import type { FrameId, InstanceId } from "../ids.js";
import { hasKeyword } from "../keywords.js";
import { getPlayer, locateCard, mustInstance, playerCardOwnerOf } from "../query.js";
import { cardsInPlay } from "../select.js";
import type { GameState } from "../state.js";
import type { LeaveRequest, SeparateDeckPlacement } from "../trigger-events.js";

/** How many leavings on the stack an interrupt has already sent to a separate deck: the next one's `order`. */
const placementsWaiting = (state: GameState): number =>
  state.stack.filter((frame) => {
    if (frame.kind !== "event" || frame.event.kind !== "cardLeavesPlay") return false;
    const leaving = frame.event.leaving;
    return leaving?.kind === "separateDeck" || (leaving?.kind === "withHost" && leaving.toSeparateDeck !== undefined);
  }).length;

/**
 * The card whose `cardLeavesPlay` waits in frame `frameId` goes to the bottom of its owner's separate deck `name`
 * instead of where it was going, when its leaving applies (its own, or its host's move for an attachment leaving with
 * its host). Rewrites the waiting leaving (`LeaveRequest separateDeck`, `withHost.toSeparateDeck`) and its `to`, so a
 * later interrupt in the same window sees where the card is now going. Returns whether it will go there; the cases that
 * leave nothing to replace are listed on the effect.
 */
export function separateDeckInsteadOfLeaving(ctx: Ctx, frameId: FrameId, name: string): boolean {
  const frame = findFrame(ctx.state, frameId);
  if (frame?.kind !== "event" || frame.cancelled || frame.event.kind !== "cardLeavesPlay") return false;
  const event = frame.event;
  const request = event.leaving;
  const id = event.instanceId;
  if (request === undefined || !cardsInPlay(ctx.state).includes(id)) return false;
  const owner = playerCardOwnerOf(ctx.state, id);
  if (owner === null || !getPlayer(ctx.state, owner)?.separateDecks[name]) return false;
  // A swap's move belongs to another card's, and a tuck's host is set. A leaving already sent to a separate deck is no
  // longer imminent, so no second interrupt reaches it (`stillImminent`; RRG 1.8 "'Would'", p. 48).
  if (request.kind === "separateDeck" || request.kind === "tuck" || request.kind === "swap") return false;
  const placement: SeparateDeckPlacement = {
    playerId: owner,
    name,
    instead: event.to,
    order: placementsWaiting(ctx.state),
  };
  let leaving: LeaveRequest;
  if (request.kind === "withHost") {
    if (request.toSeparateDeck !== undefined) return false;
    leaving = { ...request, toSeparateDeck: placement };
  } else {
    // A defeat with a destination of its own keeps it, as for a tuck (Victory X, RRG 1.8 p. 46; "instead of
    // discarding it"; `tuckInsteadOfLeaving`).
    if (
      request.kind === "defeat" &&
      (request.insteadTo !== undefined || hasKeyword(ctx.state, id, "victory", ctx.deps))
    )
      return false;
    leaving = { kind: "separateDeck", ...placement, replaced: request };
  }
  setFrame(ctx, { ...frame, event: { ...event, to: "separateDeck", leaving } });
  return true;
}

/**
 * Where an attachment leaving with its host was sent instead (`withHost.toSeparateDeck`), read from its waiting
 * `cardLeavesPlay` while the host's move takes it; undefined for any other card.
 */
export function separateDeckWithHost(state: GameState, id: InstanceId): SeparateDeckPlacement | undefined {
  for (const frame of state.stack) {
    if (frame.kind !== "event" || frame.cancelled || frame.event.kind !== "cardLeavesPlay") continue;
    if (frame.event.instanceId !== id) continue;
    const leaving = frame.event.leaving;
    if (leaving?.kind === "withHost") return leaving.toSeparateDeck;
  }
  return undefined;
}

/** After the move: the card is a facedown card of the deck (as setup leaves them) and the log says why it is there. */
export function landedInSeparateDeck(ctx: Ctx, id: InstanceId, placement: SeparateDeckPlacement): void {
  const where = locateCard(ctx.state, id);
  if (where?.kind !== "separateDeck" || where.playerId !== placement.playerId || where.name !== placement.name) return;
  updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
  emit(ctx, {
    type: "returnedToSeparateDeck",
    instanceId: id,
    cardId: mustInstance(ctx.state, id).cardId,
    playerId: placement.playerId,
    name: placement.name,
    instead: placement.instead,
    replaced: true,
  });
}

/**
 * The apply step of a leaving sent to a separate deck (`LeaveRequest separateDeck`): the card goes to the bottom of
 * that deck, as the move that was replaced would have taken it out of play (the same source card and cost, so the
 * Permanent keyword and "cannot leave play" read as they did). It is not a discard. A defeated card's Victory X
 * attachments go to the victory display first, as `defeatFromPlay` sends them.
 */
export function placeLeavingInSeparateDeck(
  ctx: Ctx,
  id: InstanceId,
  request: Extract<LeaveRequest, { kind: "separateDeck" }>,
): void {
  const made = request.replaced;
  if (permanentStopsLeaving(ctx.state, ctx.deps, id, made.sourceCardId)) {
    emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "permanent" });
    return;
  }
  if (made.kind === "defeat") {
    for (const attachment of [...mustInstance(ctx.state, id).attachments]) {
      if (hasKeyword(ctx.state, attachment, "victory", ctx.deps))
        leavePlayAtOnce(ctx, attachment, { kind: "victoryDisplay" });
    }
  }
  const asCost = "asCost" in made && made.asCost === true;
  const deck = { kind: "separateDeck", playerId: request.playerId, name: request.name } as const;
  leavePlay(ctx, id, deck, "bottom", false, undefined, made.sourceCardId, asCost);
  landedInSeparateDeck(ctx, id, request);
}
