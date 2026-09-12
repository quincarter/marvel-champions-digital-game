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
import type { Rect } from "./layout.js";

export interface Travel {
  /** Stable within one command, so a list can key on it. */
  readonly id: string;
  readonly instanceId: InstanceId;
  readonly from: Rect;
  readonly to: Rect;
}

/**
 * Zones this board never shows the inside of, whichever card sits in them —
 * a deck (own or encounter), a set-aside nemesis set, a tucked card, an event
 * mid-resolution, and cards removed from the game outright. A move between
 * two of these is a move the player was never entitled to watch happen.
 */
const HIDDEN_ZONE_KINDS = new Set<ZoneId["kind"]>(["deck", "encounterDeck", "setAside", "tucked", "resolving", "removedFromGame"]);

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
): readonly Travel[] {
  const travels: Travel[] = [];
  events.forEach((event, index) => {
    if (event.type !== "cardMoved") return;
    if (zoneKey(event.from) === zoneKey(event.to)) return;
    if (isHidden(event.from) && isHidden(event.to)) return;

    const from = anchorBefore(event.instanceId, event.from);
    const to = anchorAfter(event.instanceId, event.to);
    if (!from || !to || rectsEqual(from, to)) return;

    travels.push({ id: `travel-${index}`, instanceId: event.instanceId, from, to });
  });
  return travels;
}
