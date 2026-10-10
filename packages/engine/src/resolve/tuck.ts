/**
 * Tucking a card under another (RRG 1.8 "Tuck", p. 45), the "would be tucked" interrupt window in front of it
 * (`TriggerEvent cardBeingTucked`, docs/phase7-wave9.md §3.40 (a)), and the announcement of a tucked card's discard
 * (`TriggerEvent tuckedCardDiscarded`, §3.40 (b)).
 */

import type { CardId } from "@mc/content";
import { type Ctx, moveCard, updateInstance } from "../ctx.js";
import { leaveCauseSide, leavePlay, tuckHostKind, tuckHostPlayer } from "../effects.js";
import type { InstanceId } from "../ids.js";
import { getInstance } from "../query.js";
import { cardsInPlay } from "../select.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
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
 * (docs/phase7-wave5.md §4.1 Q17). A host that no longer exists takes nothing.
 */
export function tuckCardUnder(
  ctx: Ctx,
  id: InstanceId,
  hostId: InstanceId,
  facedown: boolean,
  sourceCardId: CardId | undefined,
): void {
  if (!getInstance(ctx.state, hostId) || !getInstance(ctx.state, id)) return;
  const patch = {
    faceup: !facedown,
    controllerId: getInstance(ctx.state, id)?.ownerId ?? null,
    attachedTo: null,
  };
  if (cardsInPlay(ctx.state).includes(id)) {
    if (leavePlay(ctx, id, { kind: "tucked", hostInstanceId: hostId }, "top", false, patch, sourceCardId) === "waiting")
      return;
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
