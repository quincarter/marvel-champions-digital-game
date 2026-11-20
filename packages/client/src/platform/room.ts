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
import { loadedPacks } from "../packs/pack-registry.js";
import { startupPacksLoaded, startupPacksPending } from "../packs/startup-packs.js";
import type { ReplayHost } from "../replay/replay-host.js";
import { ReplayHost as ReplayHostClass, WorkerReplayBackend } from "../replay/replay-host.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { appSession } from "../session.js";
import type { PlayerId } from "@mc/engine";
import { undoOf } from "../view/undo.js";
import { cleanOnlineName } from "../settings.js";
import { loadLiveWatch, type WatchOpenDeps } from "../live/watch-open.js";
import {
  NO_ROOM,
  seatOfPlayerIn,
  type LobbyPod,
  type LobbySeatSpec,
  type LobbySettingsPatch,
  type LobbyTableSpec,
  type RemoteTarget,
  type RoomState,
  type SeatOfPlayer,
} from "../live/room-state.js";
import { postRoomCommand, setRoomStateListener } from "./live-watch.js";
import { setSeatContextSource } from "../view/seat-context.js";

export type {
  EpicPod,
  EpicShared,
  EpicStart,
  EpicState,
  EpicTable,
  EpicTableRole,
  EpicTableStatus,
  LobbyPod,
  LobbyTableSpec,
  RemoteTarget,
  RoomAsk,
  RoomRequest,
  RoomState,
  SeatOfPlayer,
} from "../live/room-state.js";

let state: RoomState = NO_ROOM;
const listeners = new Set<(state: RoomState) => void>();

function publish(next: RoomState): void {
  state = next;
  for (const listener of [...listeners]) listener(state);
}

setRoomStateListener(publish);

export const roomState = (): RoomState => state;
setSeatContextSource(() => state);

/** Calls `listener` with the current state at once, then on every change. Returns the unsubscribe. */
export function onRoomState(listener: (state: RoomState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

/** The engine players behind the seats a participant holds. */
function playersOfParticipant(participantId: string): string[] {
  return state.seats.filter((s) => s.holder === participantId && s.player !== null).map((s) => s.player as string);
}

/**
 * The board's Undo (`view/undo.ts`) for the asker's own hero: takes back the last move of one of the heroes the asker
 * holds, when it is that hero's turn and the move can be taken back without a reveal. Past a reveal (a draw, a shuffle)
 * Undo needs the host's own acknowledgement at the board, so such a request is declined here. True when a move was taken
 * back. The rewind carries the version the target was worked out from, so a command that landed meanwhile refuses it.
 */
async function undoMoveOf(participantId: string): Promise<boolean> {
  const { store } = appSession();
  const { game, commandTrail, version } = store.state;
  if (!game) return false;
  for (const player of playersOfParticipant(participantId)) {
    const offer = undoOf(commandTrail, game, player as PlayerId, { pastReveals: false });
    if (offer?.kind !== "available" || offer.revealed === true) continue;
    try {
      return await store.rewindTo(offer.target, { fromVersion: version });
    } catch {
      return false;
    }
  }
  return false;
}

/** The "Online name" setting: empty until the player has been asked. */
export function onlineName(): string {
  return appSession().settings.onlineName;
}

/** Saves the "Online name" setting (trimmed, at most 24 characters) and returns what was kept. */
export function setOnlineName(name: string): string {
  const kept = cleanOnlineName(name);
  const session = appSession();
  if (session.settings.onlineName !== kept) session.settings = { ...session.settings, onlineName: kept };
  return kept;
}

/** The name a call uses: the one given (saved as the setting) or the saved one. */
function nameFor(name: string | undefined): string {
  return name === undefined ? onlineName() : setOnlineName(name);
}

/** The worker could not start (no engine worker host here): the room is unavailable. */
function unavailable(role: "host" | "guest"): void {
  publish({ ...NO_ROOM, role, connection: "ended", problem: "unavailable" });
}

/** Makes a lobby room and connects as its host. `name` (when given) is saved as the online name; empty: `problem: "no-name"`. */
export async function hostRoom(name?: string): Promise<void> {
  publish({ ...NO_ROOM, role: "host", connection: "connecting" });
  if (!postRoomCommand({ kind: "room-host", name: nameFor(name) })) unavailable("host");
}

/**
 * Joins a room by its 6-character code (any case, dashes and spaces ignored) or by room id (from a `#join=` link).
 * `name` (when given) is saved as the online name; empty: `problem: "no-name"`.
 */
export async function joinRoom(codeOrId: string, name?: string): Promise<void> {
  publish({ ...NO_ROOM, role: "guest", connection: "connecting" });
  if (!postRoomCommand({ kind: "room-join", target: codeOrId, name: nameFor(name) })) unavailable("guest");
}

/** Leaves the room (a host closes its lobby for everyone). Seat tokens are kept, so joining again restores the seats. */
export function leaveRoom(): void {
  if (state.role === "none") return;
  postRoomCommand({ kind: "room-leave" });
  publish(NO_ROOM);
}

/** Host only: changes the room's settings and/or replaces the seat list (a kept seat id keeps its holder). */
export function setLobby(change: {
  readonly settings?: LobbySettingsPatch;
  readonly seats?: readonly LobbySeatSpec[];
}): void {
  postRoomCommand({ kind: "room-lobby", ...change });
}

/** Asks for a seat (the host's own request is granted at once). */
export function requestSeat(seat: string): void {
  postRoomCommand({ kind: "room-seat", op: "request", seat });
}

/** Gives up a seat I hold, or withdraws my request for it. */
export function releaseSeat(seat: string): void {
  postRoomCommand({ kind: "room-seat", op: "release", seat });
}

/** Host only: gives a seat to a connected participant. */
export function assignSeat(seat: string, participant: string): void {
  postRoomCommand({ kind: "room-seat", op: "assign", seat, participant });
}

/** Host only: turns down a request for a seat, or takes it from its holder. */
export function denySeat(seat: string, participant: string): void {
  postRoomCommand({ kind: "room-seat", op: "deny", seat, participant });
}

/**
 * Host only: answers a seat holder's request (`RoomState.requests`). Accepted `undo`: the host performs its usual Undo,
 * then answers; accepted `adjust`: answers yes and the host uses Manual adjust itself; declined: answers no.
 * (Stub in the API commit: the behavior follows.)
 */
export async function answerRequest(id: string, accepted: boolean): Promise<void> {
  const request = state.requests.find((r) => r.id === id);
  if (state.role !== "host" || !request) return;
  let answer = accepted;
  // An accepted undo is the host's usual Undo; if it cannot be done now (nothing to take back, Strict) the answer is no.
  if (accepted && request.what === "undo") answer = await undoMoveOf(request.from);
  postRoomCommand({ kind: "room-answer", id, accepted: answer });
}

/** Guest only (Host control rooms): asks the host to undo, or to change something, with a short note (at most 140 characters). */
export function askHost(what: "undo" | "adjust", note = ""): void {
  postRoomCommand({ kind: "room-ask", what, note: note.trim().slice(0, 140) });
}

/** Guest only: dismisses the host's answer to my last request. */
export function dismissAsk(): void {
  postRoomCommand({ kind: "room-ask-clear" });
}

/** Host only: acts for a held seat whose holder is away (`RoomSeat.away`), until `giveBackSeat`. */
export function takeOverSeat(seat: string): void {
  postRoomCommand({ kind: "room-seat", op: "take-over", seat });
}

/** Host only: hands a taken-over seat back to its holder. */
export function giveBackSeat(seat: string): void {
  postRoomCommand({ kind: "room-seat", op: "give-back", seat });
}

/** The seat that plays this engine player (`p1`..), who holds it and whether this device acts for it; null with no seat. */
export function seatOfPlayer(playerId: string): SeatOfPlayer | null {
  return seatOfPlayerIn(state, playerId);
}

/** Sends a chat line (the room trims, caps and rate limits it). */
export function say(text: string): void {
  postRoomCommand({ kind: "room-say", text });
}

/**
 * Host only: starts the game on this device, watchable, and streams it into the room over the lobby's own socket. The
 * returned promise is the engine's `start` (the UI then moves to the board as for any new game).
 */
export async function startGame(config: SessionConfig): Promise<void> {
  const playMode = state.settings?.playMode;
  // Seat n plays engine player p<n> (setup's player order is the lobby's seat order): the room keeps it for the
  // proposals it forwards, and drops it from any later seat list that omits it.
  if (state.role === "host" && state.seats.length > 0 && (!state.started || state.gameOver)) {
    setLobby({ seats: state.seats.map((s, index) => ({ id: s.id, label: s.label, player: `p${index + 1}` })) });
  }
  await appSession().store.start({
    ...config,
    watchable: true,
    ...(state.roomId ? { room: state.roomId } : {}),
    ...(playMode ? { roomPlayMode: playMode } : {}),
  });
}

const followDeps: WatchOpenDeps = {
  syncUrl: syncServiceUrl(),
  packsPending: startupPacksPending,
  packsLoaded: startupPacksLoaded,
  open: async (roomId, syncUrl) => {
    const host = new ReplayHostClass(new WorkerReplayBackend());
    const channel = new MessageChannel();
    if (!postRoomCommand({ kind: "room-follow", port: channel.port1 }, [channel.port1])) {
      host.dispose();
      throw new Error("no room worker");
    }
    try {
      await host.watch(roomId, syncUrl, loadedPacks(), channel.port2);
      // Closing the watch lets the room worker drop the feed (a message port has no close event of its own).
      const dispose = host.dispose.bind(host);
      host.dispose = () => {
        postRoomCommand({ kind: "room-unfollow" });
        dispose();
      };
      return host;
    } catch (cause) {
      host.dispose();
      postRoomCommand({ kind: "room-unfollow" });
      throw cause;
    }
  },
};

/**
 * Guest only, once `state.started`: opens the room's game as a live watch (a `ReplayHost` following the room), fed by
 * the room worker rather than a socket of its own. `ok: false` carries the message key to show.
 */
export async function watchRoomGame(): Promise<
  { readonly ok: true; readonly host: ReplayHost } | { readonly ok: false; readonly message: MessageKey }
> {
  const id = state.roomId;
  if (state.role !== "guest" || !id) return { ok: false, message: "watch.link.gone" };
  return loadLiveWatch(id, followDeps);
}

// ---------------------------------------------------------------------------------------------------------------
// Epic Multiplayer (issue #882, docs/live-game-rooms.md section 10). The state is `RoomState.epic`.
//
// A seat's remote power (attack The Mangog, thwart Door Between Worlds in another table of its pod) is an ordinary
// command: `store.dispatch({ type: "remotePower", playerId, characterInstanceId, toGroupId, targetInstanceId, power })`,
// where `toGroupId` is the other table's id and the target comes from `RoomState.epic.remoteTargets`. A table host
// dispatches it on its own engine; a seat holder proposes it to its table's host as any command. The attacker's group
// pays; the owning group's engine judges the card and answers through the pod, and the result shows in both logs.

/**
 * Organizer only: turns the lobby into an Epic one with these tables (2 to 8, including `t1`; each names its pod and
 * may name its host), pods and seats (each naming its table; at most 4 per table). Seat n of a table plays that table's
 * engine player p<n>, as in a standard room. Locked once any table has a game.
 */
export function setEpic(
  tables: readonly LobbyTableSpec[],
  pods: readonly LobbyPod[],
  seats: readonly LobbySeatSpec[],
): void {
  postRoomCommand({ kind: "room-epic", tables, pods, seats });
}

/** Organizer only: makes a connected participant (a seat holder of that table, or the organizer) the host of `table`; `null` takes the host away. */
export function assignTableHost(table: string, participant: string | null): void {
  postRoomCommand({ kind: "room-table-host", table, participant });
}

/** Chooses which tables' logs this device receives: `"all"` or a list. A table I hold a seat at is always received. */
export function followTables(tables: "all" | readonly string[]): void {
  postRoomCommand({ kind: "room-follow-tables", tables });
}

/**
 * Organizer only: starts the game. Sets `RoomState.epic.start`; each table host then starts its own group's game with
 * `startEpicTable` (the organizer too, if it hosts a table).
 */
export function startEpicGame(): void {
  postRoomCommand({ kind: "room-epic-start" });
}

/**
 * Table host only, once `RoomState.epic.start` is set: starts this device's table. `config` is the table's game as a
 * standard room's (its seats' heroes and decks, the scenario `god-of-lies`, the table's difficulty); this fills in the
 * seed (made from the start's seed and the table id, so the start is deterministic), the group's place in the pod
 * (its id is the table id) and the room fields, then starts the engine. Resolves with the engine's `start`.
 */
export async function startEpicTable(config: SessionConfig): Promise<void> {
  void config;
  throw new Error("startEpicTable: not built yet");
}

/**
 * Organizer only: marks a table dropped (its host did not return; plan Q-C (b)): the game goes on without it and it no
 * longer holds up the stop rule. Ask the organizer to confirm first; this cannot be undone.
 */
export function dropTable(table: string): void {
  postRoomCommand({ kind: "room-epic-drop", table });
}

/** What I may attack or thwart in other tables of my pod right now (`RoomState.epic.remoteTargets`). */
export function reachableRemoteTargets(): readonly RemoteTarget[] {
  return state.epic?.remoteTargets ?? [];
}
