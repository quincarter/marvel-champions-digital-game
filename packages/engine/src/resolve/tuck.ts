/**
 * Tucking a card under another (RRG 1.8 "Tuck", p. 45), the "would be tucked" interrupt window in front of it
 * (`TriggerEvent cardBeingTucked`, docs/phase7-wave9.md §3.40 (a)), and the announcement of a tucked card's discard
 * (`TriggerEvent tuckedCardDiscarded`, §3.40 (b)).
 */

import type { CardId } from "@mc/content";
import { type Ctx, emit, findFrame, moveCard, setFrame, updateInstance } from "../ctx.js";
import {
  leaveCauseSide,
  leavePlay,
  leavePlayAtOnce,
  permanentStopsLeaving,
  tuckHostKind,
  tuckHostPlayer,
} from "../effects.js";
import type { FrameId, InstanceId } from "../ids.js";
import { getInstance, mustInstance } from "../query.js";
import { hasKeyword } from "../keywords.js";
import { cardsInPlay } from "../select.js";
import type { GameState } from "../state.js";
import type { LeaveRequest, ReplaceableLeave, TriggerEvent } from "../trigger-events.js";
import { pushEvents, pushEventsSharingResponses } from "./frames.js";
import { heard } from "./triggers.js";

/** What the tucks of one `EffectSpec tuckCards` share: the card whose ability tucks, and the face the cards take. */
export interface TuckSource {
  readonly sourceInstanceId: InstanceId | null;
  /** The source's card, as `leavePlay` reads it (`leaveSourceOf`); it also gives the tuck's side (`leaveCauseSide`). */
  readonly sourceCardId: CardId | undefined;
  readonly facedown: boolean;
}

/**
 * The tuck itself: `id` goes under `hostId`, faceup unless `facedown`, controlled by its owner and attached to
 * nothing. A card tucked out of play leaves play properly, so its attachments are discarded and it is a new copy
 * (RRG 1.8 "Leaves Play", p. 27; Marked for Death "tucks her faceup beneath this card", docs/phase7-wave2.md §3.10);
 * one waiting for its "when it leaves play" interrupts is given its face and controller once it has left
 * (docs/phase7-wave5.md §4.1 Q17). A host that no longer exists takes nothing. `asCost`: `sourceCardId`'s ability
 * moves it as its cost (`leavePlay`).
 */
export function tuckCardUnder(
  ctx: Ctx,
  id: InstanceId,
  hostId: InstanceId,
  facedown: boolean,
  sourceCardId: CardId | undefined,
  asCost = false,
): void {
  if (!getInstance(ctx.state, hostId) || !getInstance(ctx.state, id)) return;
  const patch = {
    faceup: !facedown,
    controllerId: getInstance(ctx.state, id)?.ownerId ?? null,
    attachedTo: null,
  };
  if (cardsInPlay(ctx.state).includes(id)) {
    const to = { kind: "tucked", hostInstanceId: hostId } as const;
    if (leavePlay(ctx, id, to, "top", false, patch, sourceCardId, asCost) === "waiting") return;
  } else moveCard(ctx, id, { kind: "tucked", hostInstanceId: hostId });
  updateInstance(ctx, id, (i) => ({ ...i, ...patch }));
}

/** The `cardBeingTucked` event of one card about to go under `hostId`, read from the game as it is now. */
function beingTucked(state: GameState, id: InstanceId, hostId: InstanceId, source: TuckSource): TriggerEvent {
  // A tuck is an effect of its card's ability, never that ability's cost: no card prints "tuck … →".
  const by = leaveCauseSide(state, source.sourceCardId);
  return {
    kind: "cardBeingTucked",
    instanceId: id,
    hostInstanceId: hostId,
    sourceInstanceId: source.sourceInstanceId,
    playerId: tuckHostPlayer(state, hostId),
    under: tuckHostKind(state, hostId),
    ...(by ? { by } : {}),
    ...(source.sourceCardId !== undefined ? { sourceCardId: source.sourceCardId } : {}),
    ...(source.facedown ? { facedown: true as const } : {}),
  };
}

/**
 * Tucks `ids` under `hostId` in order, each through a `cardBeingTucked` event when an ability hears it ("When a card
 * would be tucked under your identity by a player card effect, tuck it under here instead", docs/phase7-wave9.md
 * §3.40 (a)), else at once as before. Like every other optional announcement the event goes on the stack only when an
 * ability could react (`heard`), so a game with no such ability, or one whose ability does not match this tuck, keeps
 * its log, its state and its replay. Once one card of the effect waits for its window, the cards after it wait behind
 * it, so the cards land in the order the effect named them; the first of them resolves first.
 */
export function tuckOrAnnounce(ctx: Ctx, ids: readonly InstanceId[], hostId: InstanceId, source: TuckSource): void {
  const waiting: TriggerEvent[] = [];
  for (const id of ids) {
    const event = beingTucked(ctx.state, id, hostId, source);
    if (waiting.length > 0 || heard(ctx.state, ctx.deps, event)) waiting.push(event);
    else tuckCardUnder(ctx, id, hostId, source.facedown, source.sourceCardId);
  }
  if (waiting.length > 0) pushEvents(ctx, waiting);
}

/**
 * A tuck whose interrupts have resolved, under `hostId` (the event's own host, or the one a `replaceTuckHost` named):
 * the card goes there now, or, for a leaving card's new destination (`cardBeingTucked.leavingFrameId`), its leaving is
 * given that host and moves it when it applies.
 */
export function resolveTuck(ctx: Ctx, tuck: Extract<TriggerEvent, { kind: "cardBeingTucked" }>, hostId: InstanceId) {
  if (tuck.leavingFrameId !== undefined) setLeaveTuck(ctx, tuck.leavingFrameId, hostId);
  else tuckCardUnder(ctx, tuck.instanceId, hostId, tuck.facedown === true, tuck.sourceCardId);
}

/** The waiting, uncancelled `cardLeavesPlay` in frame `frameId` and the move it will perform, if it is still there. */
function waitingLeave(state: GameState, frameId: FrameId) {
  const frame = findFrame(state, frameId);
  if (frame?.kind !== "event" || frame.cancelled || frame.event.kind !== "cardLeavesPlay") return undefined;
  const request = frame.event.leaving;
  return request === undefined ? undefined : { frame, event: frame.event, request };
}

/**
 * Gives the leaving in frame `frameId` its new destination, under `hostId` (`LeaveRequest tuck`): the event's `to`
 * reads `"tucked"` from here on, so a later interrupt in the same window sees where the card is now going. Nothing
 * changes for a leaving that is gone, cancelled, already sent under a card or not one a tuck can replace.
 */
function setLeaveTuck(ctx: Ctx, frameId: FrameId, hostId: InstanceId): void {
  const waiting = waitingLeave(ctx.state, frameId);
  if (!waiting || !replaceable(waiting.request)) return;
  const leaving: LeaveRequest = { kind: "tuck", hostInstanceId: hostId, replaced: waiting.request };
  setFrame(ctx, { ...waiting.frame, event: { ...waiting.event, to: "tucked", leaving } });
}

const replaceable = (request: LeaveRequest): request is ReplaceableLeave =>
  request.kind === "zone" || request.kind === "moveCards" || request.kind === "defeat";

/**
 * `EffectSpec replaceLeaveDestination` (docs/phase7-wave9.md §3.20): the card whose `cardLeavesPlay` waits in frame
 * `frameId` goes under `hostId` instead of where it was going. Returns whether it will (the cases that leave nothing
 * to replace are listed on the effect). The tuck is announced as any other when an ability hears it
 * (`cardBeingTucked`, with `leavingFrameId`), so "when a card would be tucked" can still send it elsewhere; otherwise
 * the leaving is rewritten at once and nothing more is logged until the card moves.
 */
export function tuckInsteadOfLeaving(ctx: Ctx, frameId: FrameId, hostId: InstanceId, source: TuckSource): boolean {
  const waiting = waitingLeave(ctx.state, frameId);
  if (!waiting) return false;
  const { event, request } = waiting;
  const id = event.instanceId;
  const inPlay = cardsInPlay(ctx.state);
  if (id === hostId || !inPlay.includes(hostId) || !inPlay.includes(id)) return false;
  // RRG 1.8 "'Would'" (p. 48): a move already replaced leaves a second replacement nothing to replace.
  if (request.kind === "tuck") return request.hostInstanceId === hostId;
  if (!replaceable(request)) return false;
  // Already on its way under this card (a tuck of a card in play is a leaving of its own): nothing to change.
  if (request.kind === "zone" && request.zone.kind === "tucked" && request.zone.hostInstanceId === hostId) return true;
  // A defeat with a destination of its own keeps it (Victory X, RRG 1.8 p. 46; "instead of discarding it").
  if (request.kind === "defeat" && (request.insteadTo !== undefined || hasKeyword(ctx.state, id, "victory", ctx.deps)))
    return false;
  const tuck = { ...beingTucked(ctx.state, id, hostId, source), leavingFrameId: frameId };
  if (heard(ctx.state, ctx.deps, tuck)) pushEvents(ctx, [tuck]);
  else setLeaveTuck(ctx, frameId, hostId);
  return true;
}

/**
 * The apply step of a leaving sent under a card (`LeaveRequest tuck`): the card is tucked there, faceup and under its
 * owner's control, as the move that was replaced would have taken it out of play (the same source card and cost, so
 * the Permanent keyword and "cannot leave play" read as they did). A defeated card's Victory X attachments go to the
 * victory display first, as `defeatFromPlay` sends them. Returns false, with nothing moved, when the host is no
 * longer in play: the caller performs the replaced move.
 */
export function tuckLeavingCard(ctx: Ctx, id: InstanceId, request: Extract<LeaveRequest, { kind: "tuck" }>): boolean {
  if (!cardsInPlay(ctx.state).includes(request.hostInstanceId)) return false;
  const made = request.replaced;
  if (permanentStopsLeaving(ctx.state, ctx.deps, id, made.sourceCardId)) {
    emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "permanent" });
    return true;
  }
  if (made.kind === "defeat") {
    for (const attachment of [...mustInstance(ctx.state, id).attachments]) {
      if (hasKeyword(ctx.state, attachment, "victory", ctx.deps))
        leavePlayAtOnce(ctx, attachment, { kind: "victoryDisplay" });
    }
  }
  const asCost = "asCost" in made && made.asCost === true;
  tuckCardUnder(ctx, id, request.hostInstanceId, false, made.sourceCardId, asCost);
  return true;
}

/**
 * Announces each tucked card discarded since the last look (`TriggerEvent tuckedCardDiscarded`, recorded by
 * `recordTuckedDiscard`; docs/phase7-wave9.md §3.40 (b)), when an ability hears it, and empties the list; the first
 * discarded resolves first. Those recorded since the last look were discarded by one effect, one cost payment or one
 * card leaving play, so they share one response window (RRG 1.8 "Triggering Condition", p. 45). The flow looks here
 * between frames, so the window resolves before the discarding ability's next effect or, for a cost, before the
 * ability's effects. Returns true when it pushed a frame.
 */
export function announceTuckedDiscards(ctx: Ctx): boolean {
  const pending = ctx.state.pendingTuckedDiscards;
  if (!pending || pending.length === 0) return false;
  const { pendingTuckedDiscards: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events = pending
    .map((discard): TriggerEvent => ({ kind: "tuckedCardDiscarded", ...discard }))
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  pushEventsSharingResponses(ctx, events);
  return true;
}
