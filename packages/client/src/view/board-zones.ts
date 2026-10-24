/**
 * The board's zone jumps: LB / RB on a pad, `[` / `]` on a keyboard.
 *
 * The focus route (`view/focus.ts`) is one flat list, which is right for Tab but slow when the hand is nine cards long
 * and the thing you want is End turn. A zone jump hops to the first stop of the next zone, in the order a player's eye
 * travels the table: the hand, your own play area, the villain's side (villain, minions, schemes), the action bar.
 *
 * Zones are named by the cards in them (ids from the board model), not by where they were drawn, so the jump still knows
 * a card on a phone tab that is not showing: the board then switches to that tab before it lands. Zones with no stop on
 * the route right now (an empty hand, nothing in play with a usable ability) are skipped rather than landed on.
 */

import type { InstanceId } from "@mc/engine";
import type { FocusTarget } from "./focus.js";
import type { PhoneTab } from "./layout.js";

export const BOARD_ZONES = ["hand", "playArea", "villain", "actionBar"] as const;
export type BoardZone = (typeof BOARD_ZONES)[number];

/** The cards each zone holds, from the board model. */
export interface ZoneMembers {
  readonly hand: ReadonlySet<InstanceId>;
  /** Your identity and the cards you have in play. */
  readonly playArea: ReadonlySet<InstanceId>;
  /** The villain(s), minions, environments and every scheme, including a scenario's own play areas. */
  readonly villain: ReadonlySet<InstanceId>;
  /** The schemes among `villain`: on a phone they are on the Threat tab, the rest on Enemies. */
  readonly threat: ReadonlySet<InstanceId>;
}

/** Which zone a focus stop is in, or null for a stop that belongs to none (a teammate's card, a Team-Up ring). */
export function zoneOfTarget(target: FocusTarget, members: ZoneMembers): BoardZone | null {
  switch (target.kind) {
    case "card":
      if (members.hand.has(target.instanceId)) return "hand";
      if (members.playArea.has(target.instanceId)) return "playArea";
      if (members.villain.has(target.instanceId)) return "villain";
      return null;
    // Everything a decision or the bar draws as a control sits with the action bar.
    case "basic":
    case "undo":
    case "cancel":
    case "confirm":
    case "xLess":
    case "xMore":
      return "actionBar";
    case "teamUp":
      return null;
  }
}

/** The stop a zone jump lands on, and which zone that is. */
export interface ZoneStop {
  readonly zone: BoardZone;
  readonly target: FocusTarget;
}

/**
 * The stop one zone jump from `current` lands on: the first route stop of the next (`step` 1) or previous (-1) zone
 * that has any, wrapping round. Focus in no zone (nothing focused, or on a stop outside every zone) starts before the
 * first zone going forward and after the last going back. Null when the route has no stop in any zone.
 */
export function zoneJump(
  order: readonly FocusTarget[],
  members: ZoneMembers,
  current: FocusTarget | null,
  step: 1 | -1,
): ZoneStop | null {
  const firstStops = new Map<BoardZone, FocusTarget>();
  for (const target of order) {
    const zone = zoneOfTarget(target, members);
    if (zone && !firstStops.has(zone)) firstStops.set(zone, target);
  }
  if (firstStops.size === 0) return null;
  const here = current ? zoneOfTarget(current, members) : null;
  const from = here ? BOARD_ZONES.indexOf(here) : step > 0 ? -1 : BOARD_ZONES.length;
  for (let hop = 1; hop <= BOARD_ZONES.length; hop += 1) {
    const at = (((from + step * hop) % BOARD_ZONES.length) + BOARD_ZONES.length) % BOARD_ZONES.length;
    const zone = BOARD_ZONES[at]!;
    const target = firstStops.get(zone);
    if (target) return { zone, target };
  }
  return null;
}

/** The phone tab a stop sits on, or null when it is on every tab (the hand and the action bar). */
export function tabOfStop(stop: ZoneStop, members: ZoneMembers): PhoneTab | null {
  if (stop.zone === "playArea") return "me";
  if (stop.zone === "villain") {
    return stop.target.kind === "card" && members.threat.has(stop.target.instanceId) ? "threat" : "enemies";
  }
  return null;
}

/** What the right stick scrolls right now. */
export type ScrollTarget = "hand" | "playArea" | "log" | "table";

/**
 * The right stick scrolls the region that holds focus: the log once it has been focused (View), else the hand row or the
 * play area row when focus is on a card in one and that row has more than fits, else the table itself (the villain side, the action bar, nothing).
 */
export function scrollTargetOf(
  logFocused: boolean,
  focus: FocusTarget | null,
  members: ZoneMembers,
  canScroll: { readonly hand: boolean; readonly playArea: boolean },
): ScrollTarget {
  if (logFocused) return "log";
  const zone = focus ? zoneOfTarget(focus, members) : null;
  if (zone === "hand" && canScroll.hand) return "hand";
  if (zone === "playArea" && canScroll.playArea) return "playArea";
  return "table";
}

/** A row scrolls sideways: the stick's dominant axis, so pushing it up or down scrolls it as a mouse wheel would. */
export function rowScrollOf(dx: number, dy: number): number {
  return Math.abs(dx) >= Math.abs(dy) ? dx : dy;
}
