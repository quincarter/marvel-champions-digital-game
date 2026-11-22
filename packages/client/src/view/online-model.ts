/**
 * The Play online screen's layout and its "Live now" rows (issue #880), as plain data the scene draws.
 *
 * Layout by size: a wide screen (desktop, tablet landscape) is a split, the "Live now" panel on the left and the
 * controls (name, Host, Join) on the right; a phone or a portrait tablet is one column of controls with "Live now"
 * under them, as many rows as the height leaves. No region scrolls.
 *
 * The rows are this device's recently used rooms, then the public rooms whose hosts opted in to "Live now"
 * (`GET /rooms/live`, fetched by `platform/live-rooms.ts`), without the ones already among the recent rooms. When the
 * list cannot be fetched (offline, service down) there are only the recent rooms.
 */
import type { LiveRoomEntry } from "@mc/sync-worker/room-protocol";
import { formFactorFor } from "./layout.js";
import type { Rect } from "./layout.js";

export type OnlineLayoutMode = "split" | "stacked";

/** Height of one "Live now" row, the gap between rows and the panel's heading. */
export const LIVE_ROW_HEIGHT = 64;
export const LIVE_ROW_GAP = 8;
export const LIVE_HEADING_HEIGHT = 34;

/** A room this device used, as remembered. */
export interface RecentRoom {
  readonly code: string;
  readonly role: "host" | "guest";
  /** Epoch milliseconds of the last time it was opened. */
  readonly at: number;
}

/** One row of the "Live now" panel. */
export interface LiveRow {
  readonly id: string;
  /** The row's title: the room code today, a hero or scenario name from a directory. */
  readonly title: string;
  /** Which kind of row it is; the scene words it. */
  readonly kind: "hosted" | "joined" | "live";
  /** A hero identity card id for the row's picture; null draws a plain badge. */
  readonly art: string | null;
  readonly scenario: string | null;
  readonly players: number | null;
  /** When it was last used (a recent room), or null for a directory row. */
  readonly at: number | null;
  /** What the row's button does with `target`. */
  readonly action: "rejoin" | "join" | "watch";
  readonly target: string;
  /** A public room: the host's name, how it is played, its seats and whether the game has started. Null otherwise. */
  readonly host: string | null;
  readonly mode: "strict" | "host" | null;
  readonly seatsTotal: number | null;
  readonly started: boolean;
}

/** A public room asks to Join while its game has not started and a seat is free, else to Watch. */
export const liveActionFor = (entry: Pick<LiveRoomEntry, "started" | "seatsTaken" | "seatsTotal">): "join" | "watch" =>
  !entry.started && entry.seatsTaken < entry.seatsTotal ? "join" : "watch";

export function liveRowsOf(recent: readonly RecentRoom[], live: readonly LiveRoomEntry[] = []): LiveRow[] {
  const mine = recent.map((room): LiveRow => ({
    id: room.code,
    title: room.code,
    kind: room.role === "host" ? "hosted" : "joined",
    art: null,
    scenario: null,
    players: null,
    at: room.at,
    action: "rejoin",
    target: room.code,
    host: null,
    mode: null,
    seatsTotal: null,
    started: false,
  }));
  const known = new Set(recent.map((room) => room.code));
  const seen = new Set<string>();
  const others: LiveRow[] = [];
  for (const entry of live) {
    if (known.has(entry.code) || seen.has(entry.code)) continue;
    seen.add(entry.code);
    others.push({
      id: `live:${entry.code}`,
      title: entry.code,
      kind: "live",
      art: null,
      scenario: entry.scenario ?? null,
      players: entry.seatsTaken,
      at: null,
      action: liveActionFor(entry),
      target: entry.code,
      host: entry.host,
      mode: entry.mode,
      seatsTotal: entry.seatsTotal,
      started: entry.started,
    });
  }
  return [...mine, ...others];
}

export interface OnlineLayout {
  readonly mode: OnlineLayoutMode;
  /** The controls column (name, Host, Join). */
  readonly controls: Rect;
  /** The "Live now" panel, or null when a stacked screen has no height left for one row. */
  readonly live: Rect | null;
  /** How many rows fit in the panel under its heading. */
  readonly rows: number;
}

/** What the controls column needs from its top: name row, Host (text and button), Join (text and field), a message line. */
export const CONTROLS_HEIGHT = 305;

export function rowsThatFit(panelHeight: number): number {
  const room = panelHeight - LIVE_HEADING_HEIGHT;
  return Math.max(0, Math.floor((room + LIVE_ROW_GAP) / (LIVE_ROW_HEIGHT + LIVE_ROW_GAP)));
}

export function onlineLayout(width: number, height: number, barHeight: number, gutter: number): OnlineLayout {
  const form = formFactorFor(width, height);
  const top = barHeight + 20;
  const bottom = height - gutter;
  if (form === "desktop" || form === "tabletLandscape") {
    const gap = gutter * 1.5;
    const controlsWidth = Math.min(480, Math.max(380, Math.floor((width - gutter * 2 - gap) * 0.42)));
    const controls: Rect = { x: width - gutter - controlsWidth, y: top, width: controlsWidth, height: CONTROLS_HEIGHT };
    const live: Rect = { x: gutter, y: top, width: controls.x - gap - gutter, height: bottom - top };
    return { mode: "split", controls, live, rows: rowsThatFit(live.height) };
  }
  const column = Math.min(520, width - gutter * 2);
  const x = Math.floor((width - column) / 2);
  const controls: Rect = { x, y: top, width: column, height: CONTROLS_HEIGHT };
  const liveTop = top + CONTROLS_HEIGHT + 8;
  const liveHeight = bottom - liveTop;
  const rows = rowsThatFit(liveHeight);
  const live: Rect | null = rows > 0 ? { x, y: liveTop, width: column, height: liveHeight } : null;
  return { mode: "stacked", controls, live, rows };
}
