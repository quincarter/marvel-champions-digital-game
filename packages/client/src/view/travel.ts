/**
 * Card-movement tweens: turning `cardMoved` events into a flight from where a
 * card was to where it landed (PLAN.md Phase 4, "No card-movement tweens" /
 * the stack decision's "map from each card's instance id to its game object").
 *
 * This does **not** turn the Board into a persistent-object reconciler — the
 * scene still tears down and redraws every frame (`scenes/board.ts#draw`),
 * which is the existing, already-audited redraw model, and fighting it would
 * be a much larger, riskier rewrite than this pass calls for. Instead this
 * follows the same trick `beats.ts` already uses: a travel is *data* (an
 * instance id, a "from" rect and a "to" rect), not a game object. The scene
 * draws an ephemeral ghost on top of the real board — which has already been
 * redrawn, with the real card already sitting in its new spot — and tweens the
 * ghost from the recorded start to the recorded end. A redraw mid-flight can't
 * corrupt a travel because there is no object to lose: the ghost is recreated
 * from the same data, at whatever point its own elapsed time says it should
 * be (`scenes/board/motion.ts#renderTravels`).
 *
 * A travel needs an on-screen rect at *both* ends to mean anything. Two kinds
 * of rect exist on this board: the concrete rect an individually-drawn card
 * gets (a hand card, a character panel), and the coarser "pile" rect a zone
 * kind gets when nothing that specific is drawn (the encounter deck box, the
 * enemies band, the hand banner). Resolving those is the scene's job, since
 * only the scene knows about rects — this module stays pure and untestable-
 * without-a-canvas-free, taking two anchor lookups as callbacks.
 *
 * A card whose departure or arrival has neither kind of rect — the player's
 * own deck or discard pile, which this board draws only as a number, never a
 * box — simply appears, exactly as it did before this file existed. That is a
 * named, deliberate gap (see the client engineer's report), not an oversight.
 */

import type { GameEvent, InstanceId, ZoneId } from "@mc/engine";
import type { ArtSource } from "../art/art-source.js";
import type { Rect } from "./layout.js";

export interface Travel {
  /** Stable within one command, so a list can key on it. */
  readonly id: string;
  readonly instanceId: InstanceId;
  readonly from: Rect;
  readonly to: Rect;
  /** How long after the command landed the flight begins: a hand refill deals its cards one by one. 0 for every other move. */
  readonly delayMs: number;
  /** A draw from a deck into the hand: it flies longer, and its hand slot stays empty until it lands (`handArrivalsFrom`). */
  readonly draw: boolean;
  /**
   * A facedown encounter card dealt to a player (`dealtEncounter`): the ghost is the encounter card back, never the
   * card's face, whatever it became since (a card dealt and revealed in one command is already in play).
   */
  readonly facedown: boolean;
  /** The card's own face, when the scene already has it cached — the ghost draws the scan instead of a plain parchment rectangle. Null falls back to the rectangle, the same as before this existed. */
  readonly art: ArtSource | null;
}

/**
 * Zones this board never shows the inside of, whichever card sits in them —
 * a deck (own or encounter), a set-aside nemesis set, a tucked card, an event
 * mid-resolution, and cards removed from the game outright. A move between
 * two of these is a move the player was never entitled to watch happen.
 */
const HIDDEN_ZONE_KINDS = new Set<ZoneId["kind"]>([
  "deck",
  "encounterDeck",
  "setAside",
  "tucked",
  "resolving",
  "removedFromGame",
]);

function isHidden(zone: ZoneId): boolean {
  return HIDDEN_ZONE_KINDS.has(zone.kind);
}

/** A stable string for one zone, so "did this card actually change zone" is a plain comparison. */
function zoneKey(zone: ZoneId): string {
  switch (zone.kind) {
    case "hand":
    case "deck":
    case "discard":
    case "playArea":
    case "dealtEncounter":
    case "resolving":
    case "setAside":
    case "identity":
      return `${zone.kind}:${zone.playerId}`;
    case "tucked":
    case "attachment":
    case "boost":
      return `${zone.kind}:${zone.hostInstanceId}`;
    default:
      return zone.kind;
  }
}

function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** The gap between two cards of one draw, so a refill reads as cards dealt one by one. */
export const DRAW_STAGGER_MS = 100;
/** The latest a card of one draw may start, so a ten-card draw does not take two seconds. */
export const DRAW_SPREAD_MAX_MS = 600;

/** Whether a move is a card leaving a player's deck for their hand: a draw (or a search that adds to hand). */
function isDraw(from: ZoneId, to: ZoneId): boolean {
  return from.kind === "deck" && to.kind === "hand";
}

/**
 * The cards of one command that arrive in `playerId`'s hand from their deck — the slots the hand holds empty until
 * each card's ghost lands. A teammate's draw has no hand on screen, so it is not here.
 */
export function handArrivalsFrom(events: readonly GameEvent[], playerId: string): readonly InstanceId[] {
  const ids: InstanceId[] = [];
  for (const event of events) {
    if (event.type !== "cardMoved" || !isDraw(event.from, event.to)) continue;
    if (event.to.kind === "hand" && event.to.playerId === playerId) ids.push(event.instanceId);
  }
  return ids;
}

/**
 * Travels for one command's `cardMoved` events, in order.
 *
 * `anchorBefore`/`anchorAfter` each answer "where would this card be drawn, or
 * where is the pile it belongs to" — for the state just before the move and
 * just after it, respectively. A `null` from either side means no travel: the
 * card simply appears in its new zone, the same as it did before tweens
 * existed.
 */
export function travelsFrom(
  events: readonly GameEvent[],
  anchorBefore: (instanceId: InstanceId, zone: ZoneId) => Rect | null,
  anchorAfter: (instanceId: InstanceId, zone: ZoneId) => Rect | null,
  artOf: (instanceId: InstanceId) => ArtSource | null,
): readonly Travel[] {
  const travels: Travel[] = [];
  events.forEach((event, index) => {
    if (event.type !== "cardMoved") return;
    if (zoneKey(event.from) === zoneKey(event.to)) return;
    // A dealt card flips where it lies: its reveal is not a flight, so a card dealt and revealed in one command flies to
    // the player's pile and simply does not stay.
    if (event.from.kind === "dealtEncounter") return;
    if (isHidden(event.from) && isHidden(event.to)) return;

    const from = anchorBefore(event.instanceId, event.from);
    const to = anchorAfter(event.instanceId, event.to);
    if (!from || !to || rectsEqual(from, to)) return;

    travels.push({
      id: `travel-${index}`,
      instanceId: event.instanceId,
      from,
      to,
      delayMs: 0,
      draw: isDraw(event.from, event.to),
      facedown: event.to.kind === "dealtEncounter",
      art: event.to.kind === "dealtEncounter" ? null : artOf(event.instanceId),
    });
  });
  // Deal the draws, and the facedown encounter deals, one after another, in the order the engine made them.
  const draws = travels.filter((travel) => travel.draw || travel.facedown);
  const gap = draws.length > 1 ? Math.min(DRAW_STAGGER_MS, DRAW_SPREAD_MAX_MS / (draws.length - 1)) : 0;
  return travels.map((travel) => {
    const order = draws.indexOf(travel);
    return order > 0 ? { ...travel, delayMs: Math.round(order * gap) } : travel;
  });
}
