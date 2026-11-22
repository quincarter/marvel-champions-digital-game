/**
 * Who paces the villain phase screen in a room game (issue #881, `LobbySettings.villainPacing`), as plain data.
 *
 * The villain phase screen replays a phase the engine has already resolved, beat by beat (`scenes/villain-phase.ts`).
 * With "Host leads" (the default) a seated guest's screen follows the host's: the host's screen reports where it is
 * (`hostCursorOf`, sent as `villain-cursor`), and the guest's shows beats only as far as that (`followPlan`), has no
 * Next / Start / Auto-advance controls of its own, and closes when the host's does. With "Each player at their own pace"
 * every screen plays on its own, as a solo game's does. Presentation only: no command depends on it.
 *
 * The one thing pacing never holds back is a decision addressed to this device's own seat (a defend, an interrupt): it
 * reaches the guest at once, so the game never waits on a guest who has not been shown the beats before it.
 */
import type { RoomVillainCursor, VillainPacing } from "../live/room-state.js";

/** The lobby's pacing as it reads: absent (a room from before the setting) leads with the host. */
export const pacingOf = (settings: { readonly villainPacing?: VillainPacing } | null | undefined): VillainPacing =>
  settings?.villainPacing === "each" ? "each" : "host";

/** The phase a cursor is about: its round, which both screens read off the same events. */
export const phaseKeyOf = (round: number): string => String(round);

/** Whether this device's villain phase screen follows the host's: a seated guest, in a room where the host leads. */
export function followsHost(
  room: {
    readonly seatGame: boolean;
    readonly room: { readonly settings: { readonly villainPacing?: VillainPacing } | null };
  } | null,
): boolean {
  return room !== null && room.seatGame && pacingOf(room.room.settings) === "host";
}

/** The host's cursor, if it is about this phase: a cursor left from another phase is stale and ignored. */
export const cursorFor = (cursor: RoomVillainCursor | null, key: string): RoomVillainCursor | null =>
  cursor !== null && cursor.key === key ? cursor : null;

export interface FollowPlan {
  /** The host has not started this phase yet (or has said nothing): the screen waits on the host. */
  readonly waiting: boolean;
  /** How many beats the guest's screen may show. */
  readonly reveal: number;
  /** The host closed its screen: this one closes too. */
  readonly closed: boolean;
}

/**
 * What a following guest's screen does now. `total` is the beats this device knows of; `choiceDue` is true when a
 * decision for this device's own seat is open and every beat before it is already known (the walkthrough is parked on
 * it): then the guest sees everything up to it and is not made to wait on the host.
 */
export function followPlan(args: {
  readonly cursor: RoomVillainCursor | null;
  readonly total: number;
  readonly choiceDue: boolean;
}): FollowPlan {
  const { cursor, total, choiceDue } = args;
  if (cursor?.state === "closed") return { waiting: false, reveal: total, closed: true };
  if (choiceDue) return { waiting: false, reveal: total, closed: false };
  if (cursor === null || cursor.state === "gate") return { waiting: true, reveal: 0, closed: false };
  return { waiting: false, reveal: Math.max(0, Math.min(cursor.at, total)), closed: false };
}

export interface HostCursor {
  readonly key: string;
  readonly at: number;
  readonly state: RoomVillainCursor["state"];
}

/** What the host's screen reports: on the Start gate, showing `revealed` beats, or closed. */
export function hostCursorOf(args: {
  readonly key: string;
  readonly revealed: number;
  readonly waitingToStart: boolean;
  readonly closed: boolean;
}): HostCursor {
  if (args.closed) return { key: args.key, at: args.revealed, state: "closed" };
  if (args.waitingToStart) return { key: args.key, at: 0, state: "gate" };
  return { key: args.key, at: args.revealed, state: "playing" };
}

/** The cursor to send next: null when it says nothing new (the room spends a limit on every message). */
export const cursorToSend = (last: HostCursor | null, next: HostCursor): HostCursor | null =>
  last !== null && last.key === next.key && last.at === next.at && last.state === next.state ? null : next;
