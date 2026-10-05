/**
 * Swapping two arbitrary cards (`EffectSpec swapCards`, docs/phase7-wave6.md §3.47): Weather Control and Weather Goddess
 * (`storm` 36001a, 36009) swap Storm's WEATHER support in play with one from her facedown WEATHER deck.
 *
 * RRG 1.8 "'Swap'" (p. 42): the two components exchange locations; "a swap cannot be completed if there is not a
 * component in both locations"; "swapped cards maintain the orientation (such as ready or exhausted, faceup or facedown)
 * of the original card"; between a play area and an out-of-play area, cards that
 * - share a title: "neither card is considered to enter or leave play", everything on the in-play card is transferred
 *   to the other and it keeps the in-play card's state. Built as `swapVillain` builds Loki's swap: the in-play instance
 *   stays where it is with all its state (and every lasting effect, attachment or frame naming it) and takes the other
 *   card, which the out-of-play instance takes in exchange;
 * - do not share a title: "the in-play card is considered to leave play and the out-of-play card is considered to enter
 *   play", nothing transfers and "the other card enters play ready". The outgoing card leaves through `leavePlay` (its
 *   attachments discarded, its state cleared, "when it leaves play" interrupts first, Permanent's same-set exception
 *   read against the swapping ability's card, RRG 1.8 "Permanent", p. 32), into the other card's exact place with the
 *   other card's orientation; the incoming card takes the outgoing card's place, faceup if it was, under its controller,
 *   and its `cardEntersPlay` is announced (the enter-play keywords are that event's apply step).
 * Two out-of-play cards (Eidetic Memory, `silk`, erratum RRG 1.8 p. 69) just exchange places and orientations.
 *
 * Not built (refused, logged `swapRefused`): two cards both in play (no printed card does it), and identities, villains
 * and main schemes, which have their own swaps (`swapIdentity`, `swapVillain`).
 */

import type { CardId } from "@mc/content";
import { type Ctx, emit, moveCard, placeAt, syncSeparateDeckTop, updateInstance } from "../ctx.js";
import { leaveDestinationKind, leavePlay, permanentStopsLeaving, waitsForLeaveInterrupts } from "../effects.js";
import type { GameEvent } from "../events.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { cardOf, getInstance, locateCard, mustInstance, zoneContents } from "../query.js";
import { cannotLeavePlay } from "../rules.js";
import { cardsInPlay, controllerOf } from "../select.js";
import type { ZoneId } from "../state.js";
import { matchingCardInPlay } from "../unique.js";
import { pushEvents } from "./frames.js";
import { markPreThenUnresolved } from "./then.js";

/** How a swap ended: done, waiting for the outgoing card's "when it leaves play" interrupts, or not completed. */
export type SwapOutcome = "swapped" | "waiting" | "refused";

type Refusal = Extract<GameEvent, { type: "swapRefused" }>["reason"];

const sameZone = (a: ZoneId, b: ZoneId): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Where a card is and at which position (0 is the top), or null when it is in no zone. */
function placeOf(ctx: Ctx, id: InstanceId): { readonly zone: ZoneId; readonly index: number } | null {
  const zone = locateCard(ctx.state, id);
  if (!zone) return null;
  return { zone, index: zone.kind === "identity" ? 0 : zoneContents(ctx.state, zone).indexOf(id) };
}

/** An identity, a villain or a main scheme: each has its own swap (`swapIdentity`, `swapVillain`). */
function hasOwnSwap(ctx: Ctx, id: InstanceId): boolean {
  const state = ctx.state;
  if (state.players.some((p) => p.identity.instanceId === id)) return true;
  if (state.villains.some((v) => v.instanceId === id)) return true;
  const type = cardOf(state, id)?.type;
  return type === "main_scheme" || type === "hero_identity" || type === "villain";
}

/**
 * Swaps `a` and `b` (either order: whichever is in play is the outgoing card). `sourceCardId`: the card whose ability
 * swaps them, for Permanent's same-set exception. `frameId`: the effects frame, marked "not fully resolved" for a
 * "then" when the swap cannot be completed (RRG 1.8 "'Then'", p. 44).
 */
export function swapCards(
  ctx: Ctx,
  a: InstanceId | undefined,
  b: InstanceId | undefined,
  sourceCardId?: CardId,
  frameId?: FrameId,
): SwapOutcome {
  const refuse = (reason: Refusal, ids: readonly (InstanceId | undefined)[]): SwapOutcome => {
    emit(ctx, {
      type: "swapRefused",
      reason,
      instanceIds: ids.filter((id): id is InstanceId => id !== undefined),
    });
    markPreThenUnresolved(ctx, frameId, "swapNotCompleted");
    return "refused";
  };
  if (a === undefined || b === undefined || a === b) return refuse("missingCard", [a, b]);
  if (!getInstance(ctx.state, a) || !getInstance(ctx.state, b)) return refuse("missingCard", [a, b]);
  if (hasOwnSwap(ctx, a) || hasOwnSwap(ctx, b)) return refuse("unsupported", [a, b]);
  if (!placeOf(ctx, a) || !placeOf(ctx, b)) return refuse("missingCard", [a, b]);
  const inPlay = cardsInPlay(ctx.state);
  const aIn = inPlay.includes(a);
  const bIn = inPlay.includes(b);
  if (aIn && bIn) return refuse("bothInPlay", [a, b]);
  if (!aIn && !bIn) return exchangeOutOfPlay(ctx, a, b);
  const [outgoing, incoming] = aIn ? [a, b] : [b, a];
  const outCard = cardOf(ctx.state, outgoing);
  const inCard = cardOf(ctx.state, incoming);
  if (!outCard || !inCard) return refuse("missingCard", [a, b]);
  if (outCard.name === inCard.name) return exchangeSameTitle(ctx, outgoing, incoming);

  if (
    permanentStopsLeaving(ctx.state, ctx.deps, outgoing, sourceCardId) ||
    cannotLeavePlay(ctx.state, ctx.deps, outgoing, sourceCardId)
  )
    return refuse("cannotLeavePlay", [outgoing]);
  const out = placeOf(ctx, outgoing)!;
  const into = placeOf(ctx, incoming)!;
  const controller: PlayerId | null =
    controllerOf(ctx.state, outgoing) ?? ("playerId" in out.zone ? out.zone.playerId : null);
  if (matchingCardInPlay(ctx.state, inCard, new Set([outgoing, incoming]), controller, ctx.deps))
    return refuse("unique", [incoming]);

  // "When X leaves play" interrupts resolve before the swap (docs/phase7-wave5.md §4.1 Q17): the outgoing card waits in
  // play, and the leaving's apply step calls this again (`applyLeavingPlay`, request `swap`), which then goes ahead.
  const going = leaveDestinationKind(ctx.state, ctx.deps, outgoing, into.zone.kind, false);
  const request = { kind: "swap", with: incoming, ...(sourceCardId !== undefined ? { sourceCardId } : {}) } as const;
  if (waitsForLeaveInterrupts(ctx, outgoing, request, going)) return "waiting";

  const outFaceup = mustInstance(ctx.state, outgoing).faceup;
  const inFaceup = mustInstance(ctx.state, incoming).faceup;
  if (leavePlay(ctx, outgoing, into.zone, "bottom", false, undefined, sourceCardId) !== "left")
    return refuse("cannotLeavePlay", [outgoing]);
  moveCard(ctx, incoming, out.zone);
  const minion = inCard.type === "minion";
  const engagedWith = minion && "playerId" in out.zone ? out.zone.playerId : null;
  updateInstance(ctx, incoming, (i) => ({
    ...i,
    faceup: outFaceup,
    exhausted: false,
    controllerId: minion ? null : controller,
    engagedWith,
  }));
  placeAt(ctx, incoming, out.index);
  const landed = locateCard(ctx.state, outgoing);
  if (landed && sameZone(landed, into.zone)) {
    placeAt(ctx, outgoing, into.index);
    // A separate deck shows what its own rules say (`syncSeparateDeckTop`, run by `placeAt`); elsewhere it takes the
    // orientation the other card had there.
    if (landed.kind !== "separateDeck") updateInstance(ctx, outgoing, (i) => ({ ...i, faceup: inFaceup }));
  }
  emit(ctx, {
    type: "cardsSwapped",
    how: "leftAndEntered",
    outgoing,
    incoming,
    cardIds: [outCard.id, inCard.id],
  });
  pushEvents(ctx, [{ kind: "cardEntersPlay", instanceId: incoming, playerId: engagedWith ?? controller }]);
  return "swapped";
}

/**
 * Sharing a title: the in-play instance keeps its place and everything on it (tokens, attachments, tucked cards,
 * status cards, exhaustion, damage) and takes the other card; the out-of-play instance takes the old card, where it is,
 * as it is (RRG 1.8 p. 42; the shape of `swapVillain`'s `exchangeCards`).
 */
function exchangeSameTitle(ctx: Ctx, outgoing: InstanceId, incoming: InstanceId): SwapOutcome {
  const out = mustInstance(ctx.state, outgoing);
  const into = mustInstance(ctx.state, incoming);
  updateInstance(ctx, outgoing, (i) => ({ ...i, cardId: into.cardId, ownerId: into.ownerId, home: into.home }));
  updateInstance(ctx, incoming, (i) => ({ ...i, cardId: out.cardId, ownerId: out.ownerId, home: out.home }));
  const zone = locateCard(ctx.state, incoming);
  if (zone?.kind === "separateDeck") syncSeparateDeckTop(ctx, zone.playerId, zone.name);
  emit(ctx, { type: "cardsSwapped", how: "sameTitle", outgoing, incoming, cardIds: [out.cardId, into.cardId] });
  return "swapped";
}

/** Two out-of-play cards exchange places and orientations; neither enters or leaves play. */
function exchangeOutOfPlay(ctx: Ctx, a: InstanceId, b: InstanceId): SwapOutcome {
  const at = placeOf(ctx, a)!;
  const bt = placeOf(ctx, b)!;
  const aFaceup = mustInstance(ctx.state, a).faceup;
  const bFaceup = mustInstance(ctx.state, b).faceup;
  moveCard(ctx, a, bt.zone);
  moveCard(ctx, b, at.zone);
  // In one zone, placing the lower index first leaves the higher one where it belongs.
  const placements: [InstanceId, number][] = [
    [a, bt.index],
    [b, at.index],
  ];
  placements.sort((x, y) => x[1] - y[1]);
  for (const [id, index] of placements) placeAt(ctx, id, index);
  for (const [id, faceup] of [
    [a, bFaceup],
    [b, aFaceup],
  ] as const) {
    if (locateCard(ctx.state, id)?.kind !== "separateDeck") updateInstance(ctx, id, (i) => ({ ...i, faceup }));
  }
  emit(ctx, {
    type: "cardsSwapped",
    how: "outOfPlay",
    outgoing: a,
    incoming: b,
    cardIds: [mustInstance(ctx.state, a).cardId, mustInstance(ctx.state, b).cardId],
  });
  return "swapped";
}
