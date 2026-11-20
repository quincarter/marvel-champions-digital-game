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
  type SeatDeckEntry,
  type SeatOfPlayer,
} from "../live/room-state.js";
import { epicTableConfig } from "../live/epic-start.js";
import { RoomDeckWorker } from "../live/room-deck-check-client.js";
import { withRequiredPacks } from "../packs/pack-runtime.js";
import {
  startRoomGame as runRoomStart,
  type RoomGameBase,
  type RoomStartDeps,
  type RoomStartResult,
} from "../live/room-start.js";
import type { DeckOption } from "../view/deck-list-model.js";
import { postRoomCommand, setRoomDecksListener, setRoomStateListener } from "./live-watch.js";
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

/** Answers to the host's requests for the seats' full decks, by request id (the room worker posts them back). */
const deckRequests = new Map<number, (decks: readonly SeatDeckEntry[] | null) => void>();
let nextDeckRequest = 0;
setRoomDecksListener((id, decks) => {
  const answer = deckRequests.get(id);
  deckRequests.delete(id);
  answer?.(decks);
});

/** The room worker answers in 8 seconds at most; this is for the worker itself being gone. */
const DECKS_WAIT_MS = 12_000;

function requestSeatDecks(): Promise<readonly SeatDeckEntry[] | null> {
  return new Promise((resolve) => {
    const id = ++nextDeckRequest;
    const timer = setTimeout(() => {
      deckRequests.delete(id);
      resolve(null);
    }, DECKS_WAIT_MS);
    deckRequests.set(id, (decks) => {
      clearTimeout(timer);
      resolve(decks);
    });
    if (!postRoomCommand({ kind: "room-decks-request", id })) {
      deckRequests.delete(id);
      clearTimeout(timer);
      resolve(null);
    }
  });
}

export const roomState = (): RoomState => state;

/** Dev only (`scenes/boot-dev-jump.ts`): shows a made-up room to the screens, as if the room worker had sent it. */
export function previewRoomState(next: RoomState): void {
  if (import.meta.env.DEV) publish(next);
}
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
export function leaveRoom(options: { readonly closeRoom?: boolean } = {}): void {
  if (state.role === "none") return;
  postRoomCommand({ kind: "room-leave", ...(options.closeRoom ? { closeRoom: true } : {}) });
  deckWorker.destroy();
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

/**
 * Why a deck could not be put in a seat: `not-seatable` (illegal or not ready on this device, `option.blockedReason` says
 * why: the host would refuse it too), `too-large` (a list over the room's size cap), `not-allowed` (a seat that is not
 * mine, or a preset by a guest), `no-seat`.
 */
export type ChooseDeckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not-seatable" | "too-large" | "not-allowed" | "no-seat" | "no-worker" };

/** Builds decks and judges them off the main thread; lives while the room is used and ends after a quiet minute. */
const deckWorker = new RoomDeckWorker();

async function sendDeck(seat: string, option: DeckOption, preset: boolean): Promise<ChooseDeckResult> {
  const mine = state.seats.find((s) => s.id === seat);
  if (!mine) return { ok: false, reason: "no-seat" };
  if (preset ? state.role !== "host" : !mine.mine) return { ok: false, reason: "not-allowed" };
  if (!option.seatable) return { ok: false, reason: "not-seatable" };
  const built = await deckWorker.deck(
    option.deck,
    option.identityName ?? (option.deck.identityCardId as string),
    loadedPacks(),
  );
  if (!built.ok) return { ok: false, reason: built.reason === "too-large" ? "too-large" : "no-worker" };
  postRoomCommand({ kind: "room-deck", seat, deck: built.deck });
  return { ok: true };
}

/**
 * Puts my deck in a seat I hold: a saved, imported or precon deck from this device's own list (`DeckOption`s, the way the
 * Decks screen and Table setup list them). Everyone sees only a summary (hero, aspect, name, card count, mods); the full
 * list goes to the host alone. The room rate limits it; a refusal shows as `state.refusal`.
 */
export function chooseDeck(seat: string, option: DeckOption): Promise<ChooseDeckResult> {
  return sendDeck(seat, option, false);
}

/** Host only: presets a deck for any seat; the holder may replace it with their own, and it stays through a change of holder. */
export function presetDeck(seat: string, option: DeckOption): Promise<ChooseDeckResult> {
  return sendDeck(seat, option, true);
}

/** Sends a chat line (the room trims, caps and rate limits it). */
export function say(text: string): void {
  postRoomCommand({ kind: "room-say", text });
}

/**
 * Host only: Start for a room where each player brought their own hero and deck. `base` is the host's game without its
 * players (scenario, difficulty, rules, modular sets, ...). Fetches every seat's deck from the room, judges all of them
 * in a worker (`live/room-deck.ts`), tells only each failing seat's holder why through `deck-refused`, and otherwise
 * starts the game from the seats' decks (in seat order). Nothing starts unless every seat is held and every deck passes.
 * The result says what stopped it, for the host's own words; a deck refused for a seat the host holds is in
 * `refused` but not sent to the room (the host reads it there).
 */
export function startRoomGame(base: RoomGameBase): Promise<RoomStartResult> {
  return runRoomStart(
    base,
    roomStartDeps(async (config) => startGame(config)),
  );
}

/**
 * Epic table host only, once `RoomState.epic.start` is set: the same deck path as `startRoomGame` for this table's seats
 * (their decks fetched from the room, judged in a worker, refusals told to each holder), then `startEpicTable`.
 */
export function startEpicTableRoomGame(base: RoomGameBase, seatIds: readonly string[]): Promise<RoomStartResult> {
  return runRoomStart(base, { ...roomStartDeps(startEpicTable), seatIds });
}

function roomStartDeps(begin: (config: SessionConfig) => Promise<void>): RoomStartDeps {
  return {
    state: roomState,
    requestDecks: requestSeatDecks,
    refuse: (refusal) => {
      postRoomCommand({ kind: "room-deck-refuse", ...refusal });
    },
    check: (input) => {
      const loaded = loadedPacks();
      const allowedPacks = loaded.filter((p) => input.allowed.some((m) => m.id === p.id && m.version === p.version));
      return deckWorker.check(input, loaded, withRequiredPacks(allowedPacks, loaded));
    },
    start: async (config) => {
      try {
        await begin(config);
      } catch (cause) {
        return cause instanceof Error ? cause.message : String(cause);
      }
      const { store } = appSession();
      return store.state.status === "failed" ? (store.state.error ?? "failed") : null;
    },
  };
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

/** Names each watch feed, so closing an old one never closes the feed that replaced it. */
let lastFeedId = 0;

const followDeps: WatchOpenDeps = {
  syncUrl: syncServiceUrl(),
  packsPending: startupPacksPending,
  packsLoaded: startupPacksLoaded,
  open: async (roomId, syncUrl) => {
    const host = new ReplayHostClass(new WorkerReplayBackend());
    const channel = new MessageChannel();
    const feedId = ++lastFeedId;
    if (!postRoomCommand({ kind: "room-follow", port: channel.port1, feedId }, [channel.port1])) {
      host.dispose();
      throw new Error("no room worker");
    }
    try {
      await host.watch(roomId, syncUrl, loadedPacks(), channel.port2);
      // Closing the watch lets the room worker drop the feed (a message port has no close event of its own).
      const dispose = host.dispose.bind(host);
      host.dispose = () => {
        postRoomCommand({ kind: "room-unfollow", feedId });
        dispose();
      };
      return host;
    } catch (cause) {
      host.dispose();
      postRoomCommand({ kind: "room-unfollow", feedId });
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
  // A guest, or an Epic organizer who runs no table: it watches a table without playing at one.
  const watcher = state.role === "guest" || (state.role === "host" && state.epic !== null && !state.epic.hostsTable);
  if (!watcher || !id) return { ok: false, message: "watch.link.gone" };
  return loadLiveWatch(id, followDeps);
}

/**
 * Epic: swaps the watched table in place, without leaving the room. Follows only `table`, then opens its game as a live
 * watch the way `watchRoomGame` does; the caller swaps the returned host into its watch view and disposes the old one
 * (closing it does not close this feed). `ok: false` for a seat holder or table host (they watch their own table), an
 * unknown table, or a room that is not Epic. An organizer who hosts no table may watch any table this way.
 */
export async function watchTable(
  table: string,
): Promise<{ readonly ok: true; readonly host: ReplayHost } | { readonly ok: false; readonly message: MessageKey }> {
  const epic = state.epic;
  if (!epic || epic.hostsTable || epic.myTable || !epic.tables.some((t) => t.id === table)) {
    return { ok: false, message: "watch.link.gone" };
  }
  postRoomCommand({ kind: "room-watch-table", table });
  return watchRoomGame();
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
  const playMode = state.settings?.playMode;
  await appSession().store.start(
    epicTableConfig(config, state.epic, { roomId: state.roomId, ...(playMode ? { playMode } : {}) }),
  );
}

/**
 * Organizer only: marks a table dropped (its host did not return; plan Q-C (b)): the game goes on without it and it no
 * longer holds up the stop rule. Ask the organizer to confirm first; this cannot be undone.
 */
export function dropTable(table: string): void {
  postRoomCommand({ kind: "room-epic-drop", table });
}

/**
 * Table host only, when `RoomState.epic.podStuck` is true: gives up waiting for the pod coordinator. The engine refuses
 * unless the group is waiting for a `sharedAck`; its unanswered shared event keeps its number and is re-sent when a
 * coordinator returns, whose late answer changes nothing.
 */
export function releasePod(): void {
  postRoomCommand({ kind: "room-pod-release" });
}

/** What I may attack or thwart in other tables of my pod right now (`RoomState.epic.remoteTargets`). */
export function reachableRemoteTargets(): readonly RemoteTarget[] {
  return state.epic?.remoteTargets ?? [];
}
