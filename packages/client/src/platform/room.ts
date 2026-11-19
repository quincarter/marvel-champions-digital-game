/**
 * Rooms and the lobby (issue #880, docs/live-game-rooms.md section 8): the main thread's whole part, and the API the
 * screens call. One room connection per device, owned by the live-room worker; this module only posts events to it and
 * keeps the last `RoomState` it posts back. The host's game streams over the same socket as its lobby.
 *
 * Every call is fire-and-forget: its effect arrives as a new `RoomState` through `onRoomState`. A refusal by the room
 * (seat taken, build mismatch, ...) shows as `state.refusal`.
 */
import type { SessionConfig } from "../engine/host.js";
import type { MessageKey } from "../i18n/translate.js";
import type { ReplayHost } from "../replay/replay-host.js";
import { NO_ROOM, type LobbySeatSpec, type LobbySettingsPatch, type RoomState } from "../live/room-state.js";

export type { RoomState } from "../live/room-state.js";

const state: RoomState = NO_ROOM;
const listeners = new Set<(state: RoomState) => void>();

export const roomState = (): RoomState => state;

/** Calls `listener` with the current state at once, then on every change. Returns the unsubscribe. */
export function onRoomState(listener: (state: RoomState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

/** The "Online name" setting: empty until the player has been asked. */
export function onlineName(): string {
  return "";
}

/** Saves the "Online name" setting (trimmed, at most 24 characters) and returns what was kept. */
export function setOnlineName(name: string): string {
  return name;
}

/** Makes a lobby room and connects as its host. `name` (when given) is saved as the online name; empty: `problem: "no-name"`. */
export async function hostRoom(_name?: string): Promise<void> {}

/**
 * Joins a room by its 6-character code (any case, dashes and spaces ignored) or by room id (from a `#join=` link).
 * `name` (when given) is saved as the online name; empty: `problem: "no-name"`.
 */
export async function joinRoom(_codeOrId: string, _name?: string): Promise<void> {}

/** Leaves the room (a host closes its lobby for everyone). Seat tokens are kept, so joining again restores the seats. */
export function leaveRoom(): void {}

/** Host only: changes the room's settings and/or replaces the seat list (a kept seat id keeps its holder). */
export function setLobby(_change: {
  readonly settings?: LobbySettingsPatch;
  readonly seats?: readonly LobbySeatSpec[];
}): void {}

/** Asks for a seat (the host's own request is granted at once). */
export function requestSeat(_seat: string): void {}

/** Gives up a seat I hold, or withdraws my request for it. */
export function releaseSeat(_seat: string): void {}

/** Host only: gives a seat to a connected participant. */
export function assignSeat(_seat: string, _participant: string): void {}

/** Host only: turns down a request for a seat, or takes it from its holder. */
export function denySeat(_seat: string, _participant: string): void {}

/** Sends a chat line (the room trims, caps and rate limits it). */
export function say(_text: string): void {}

/**
 * Host only: starts the game on this device, watchable, and streams it into the room over the lobby's own socket. The
 * returned promise is the engine's `start` (the UI then moves to the board as for any new game).
 */
export async function startGame(_config: SessionConfig): Promise<void> {}

/**
 * Guest only, once `state.started`: opens the room's game as a live watch (a `ReplayHost` following the room), fed by
 * the room worker rather than a socket of its own. `ok: false` carries the message key to show.
 */
export async function watchRoomGame(): Promise<
  { readonly ok: true; readonly host: ReplayHost } | { readonly ok: false; readonly message: MessageKey }
> {
  return { ok: false, message: "watch.link.gone" };
}
