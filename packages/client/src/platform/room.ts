/**
 * Rooms and the lobby (issue #880, docs/live-game-rooms.md section 8): the main thread's whole part, and the API the
 * screens call. One room connection per device, owned by the live-room worker; this module only posts events to it and
 * keeps the last `RoomState` it posts back. The host's game streams over the same socket as its lobby.
 *
 * Every call is fire-and-forget: its effect arrives as a new `RoomState` through `onRoomState`. A refusal by the room
 * (seat taken, build mismatch, ...) shows as `state.refusal`.
 */
import { lobbyUndoFor } from "@mc/sync-worker/room-protocol";
import { forgetRoom, roomIsOver } from "./recent-rooms.js";
import type { EngineHost, SessionConfig } from "../engine/host.js";
import type { HostActivityStep } from "@mc/sync-worker/room-protocol";
import type { MessageKey } from "../i18n/translate.js";
import { currentScenarios } from "../content/pool.js";
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
  type TeamId,
} from "../live/room-state.js";
import { observeSeatedGame } from "./watch-history.js";
import { RoomPlayBindings } from "./room-play-binding.js";
import { RoomPlayWriter } from "./room-play-writer.js";
import { trackChatSent, trackRoomState, type RoomPlayTracker } from "../live/room-play-tracker.js";
import type { RoomPlayRecord } from "../engine/room-play.js";
import { epicTableConfig } from "../live/epic-start.js";
import { RoomDeckWorker } from "../live/room-deck-check-client.js";
import { withRequiredPacks } from "../packs/pack-runtime.js";
import {
  startRoomGame as runRoomStart,
  type RoomGameBase,
  type RoomStartDeps,
  type RoomStartResult,
} from "../live/room-start.js";
import { currentCardsById, POOL_SCENARIOS } from "../content/pool.js";
import type { DeckOption } from "../view/deck-list-model.js";
import { postRoomCommand, setRoomDecksListener, setRoomStateListener, setSealedListener } from "./live-watch.js";
import {
  buildCompetitiveConfig,
  leaderClashRefusals,
  competitiveSeatOrder,
  localPlayersOf,
  roomTeamsOf,
  type SealedScenarios,
} from "../live/competitive-start.js";
import { setSeatContextSource } from "../view/seat-context.js";
import { askAllowedOf } from "../view/room-ask-policy.js";

export type {
  CompetitiveState,
  CompetitiveTeam,
  TeamId,
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
export type { CompetitiveSetup, SealedScenarios } from "../live/competitive-start.js";

let state: RoomState = NO_ROOM;
const listeners = new Set<(state: RoomState) => void>();

/** The room game this device is playing (#909), gathered from the states below; null outside a game. */
let playTracker: RoomPlayTracker | null = null;
const playFinished = new Set<(record: RoomPlayRecord) => void>();

/**
 * Calls `listener` with how this device played each room game, when the game ends (a seat holder only: a guest with no
 * seat makes none). The host's record is also written to its own save by this module; a guest's is for its own finished
 * row (#909 R3). Returns the unsubscribe.
 */
export function onRoomPlayFinished(listener: (record: RoomPlayRecord) => void): () => void {
  playFinished.add(listener);
  return () => playFinished.delete(listener);
}

/**
 * Writes the running game's room play to its save, confirmed and retried (`room-play-writer.ts`): a record is not
 * counted as written before the write resolved, so a failed one is tried again with the next state or a backoff.
 */
const playWriter = new RoomPlayWriter<EngineHost>({
  // The host captured when the record was submitted, not the app's current one (it may be a seat or replay host by the
  // time of a retry); one that cannot record rejects, so the record stays dirty instead of reading as written.
  write: (gameId, record, host) => {
    if (!host.recordRoomPlay) return Promise.reject(new Error("this host cannot record room play"));
    return host.recordRoomPlay(gameId, record);
  },
  load: async (gameId, host) => (await host.listSaves()).find((save) => save.id === gameId)?.roomPlay ?? null,
});

/** Which save and host each tracked room game writes to, fixed when it starts (`room-play-binding.ts`). */
const playBindings = new RoomPlayBindings<EngineHost>();

/**
 * Writes a room game's record to the save it was bound to when it started, through the host that ran it: a late update
 * of room game A after the app moved to a local game B goes to A's save, never B's. `table` is the game's table.
 */
function writeRoomPlay(record: RoomPlayRecord, table: string): void {
  const bound = playBindings.resolve(
    record.roomId,
    table,
    () => ({ gameId: appSession().store.state.gameId, owner: appSession().host }),
    record.gid ?? null,
  );
  if (!bound) return;
  playWriter.submit(bound.gameId, record, bound.owner);
}

function trackPlay(next: RoomState): void {
  // A game that starts with this device seated is one it played, not watched: a lobby claim that was released before
  // Start never counts (`observeSeatedGame`).
  observeSeatedGame({
    roomId: next.roomId,
    tableId: next.tableId,
    gid: next.gid,
    started: next.started && !next.gameOver,
    seated: next.seats.some((s) => s.mine || (next.role === "host" && s.takenOver)),
  });
  const previous = playTracker;
  const step = trackRoomState(previous, next);
  playTracker = step.tracker;
  playBindings.advance(previous, step.tracker);
  const table = (step.tracker ?? previous)?.table ?? next.tableId ?? "main";
  // As soon as the game starts, not only at its end: a refresh or a drop in between still finds it a room game.
  if (step.progress) writeRoomPlay(step.progress, table);
  const record = step.finished;
  if (!record) {
    if (!step.tracker) playBindings.release();
    return;
  }
  if (record.role === "host") writeRoomPlay(record, table);
  playBindings.release();
  for (const listener of [...playFinished]) listener(record);
}

/** The last host activity sent to the room (step and scenario), forgotten on leaving it. */
let lastActivity: { readonly step: HostActivityStep; readonly scenario?: string } | null = null;
/** A dropped socket cleared the room's copy of it: it is sent again once the room is back. */
let resendActivity = false;

function publish(next: RoomState): void {
  state = next;
  trackPlay(next);
  if (
    next.role === "none" ||
    next.connection === "idle" ||
    next.connection === "connecting" ||
    next.connection === "ended"
  ) {
    lastActivity = null;
    resendActivity = false;
  } else if (next.connection === "reconnecting") resendActivity = true;
  else if (next.connection === "connected" && resendActivity) {
    resendActivity = false;
    if (next.role === "host" && lastActivity) {
      const { step, scenario } = lastActivity;
      postRoomCommand({ kind: "room-activity", step, ...(scenario ? { scenario } : {}) });
    }
  }
  if (next.connection === "ended" && next.code && roomIsOver(next.problem)) forgetRoom(next.code);
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
  lastActivity = null;
  if (state.role === "none") return;
  postRoomCommand({ kind: "room-leave", ...(options.closeRoom ? { closeRoom: true } : {}) });
  deckWorker.destroy();
  publish(NO_ROOM);
}

/** Host only: changes the room's settings and/or replaces the seat list (a kept seat id keeps its holder). */
export function setLobby(change: {
  readonly settings?: LobbySettingsPatch;
  readonly seats?: readonly LobbySeatSpec[];
  /** Compare and swap: the lobby revision this change was worked out against (the room refuses it if it moved on). */
  readonly ifRev?: number;
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
  // The room's policy decides what may be asked: an undo only under "ask", a change only with cheats on (#904).
  if (!askAllowedOf(request.what, state.settings)) answer = false;
  // An accepted undo is the host's usual Undo; if it cannot be done now (nothing to take back, Strict) the answer is no.
  if (answer && request.what === "undo") answer = await undoMoveOf(request.from);
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

/** Gets the deck worker ready (booted, packs sent) while a player is still choosing a deck. */
export function warmDeckWorker(): void {
  deckWorker.warm(loadedPacks());
}

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

/**
 * Host only: tells the room which setup step this device is in (picking a scenario, setting the table, ...), so the
 * lobby can say so to everyone. Does nothing unless this device hosts a room; `idle` clears it. The room keeps it in
 * memory only, so this is cheap and never touches the lobby.
 */
export function reportHostActivity(step: HostActivityStep, scenario?: string): void {
  if (state.role !== "host" || state.connection === "idle") return;
  // The same step and scenario as the last one sent says nothing new (and would only spend the room's limit).
  if (lastActivity && lastActivity.step === step && lastActivity.scenario === scenario) return;
  const sent = postRoomCommand({ kind: "room-activity", step, ...(scenario ? { scenario } : {}) });
  if (sent) lastActivity = { step, ...(scenario ? { scenario } : {}) };
}

/** A scenario's printed name for the status line, or undefined when it is not in the pool. */
function scenarioName(id: string | undefined): string | undefined {
  return id ? currentScenarios().find((s) => (s.id as string) === id)?.name : undefined;
}

/** Sends a chat line (the room trims, caps and rate limits it). */
export function say(text: string): void {
  if (postRoomCommand({ kind: "room-say", text }) && text.trim() !== "") playTracker = trackChatSent(playTracker);
}

/**
 * Host only: Start for a room where each player brought their own hero and deck. `base` is the host's game without its
 * players (scenario, difficulty, rules, modular sets, ...). Fetches every seat's deck from the room, judges all of them
 * in a worker (`live/room-deck.ts`), tells only each failing seat's holder why through `deck-refused`, and otherwise
 * starts the game from the seats' decks (in seat order). Nothing starts unless every seat is held and every deck passes.
 * The result says what stopped it, for the host's own words; a deck refused for a seat the host holds is in
 * `refused` but not sent to the room (the host reads it there).
 */
export async function startRoomGame(base: RoomGameBase): Promise<RoomStartResult> {
  return withHostActivity(base, () =>
    runRoomStart(
      base,
      roomStartDeps(async (config) => startGame(config), base),
    ),
  );
}

/**
 * Epic table host only, once `RoomState.epic.start` is set: the same deck path as `startRoomGame` for this table's seats
 * (their decks fetched from the room, judged in a worker, refusals told to each holder), then `startEpicTable`.
 */
export function startEpicTableRoomGame(base: RoomGameBase, seatIds: readonly string[]): Promise<RoomStartResult> {
  return withHostActivity(base, () => runRoomStart(base, { ...roomStartDeps(startEpicTable, base), seatIds }));
}

/** A start that did not deal the game leaves the host in the lobby: the status line is over (a game that started
 * already cleared it in the room). */
async function withHostActivity(base: RoomGameBase, run: () => Promise<RoomStartResult>): Promise<RoomStartResult> {
  const result = await run();
  if (!result.ok) reportHostActivity("idle");
  return result;
}

function roomStartDeps(begin: (config: SessionConfig) => Promise<void>, base: RoomGameBase): RoomStartDeps {
  const scenario = base.scenarioId as string | undefined;
  return {
    state: roomState,
    requestDecks: requestSeatDecks,
    refuse: (refusal) => {
      postRoomCommand({ kind: "room-deck-refuse", ...refusal });
    },
    check: (input) => {
      reportHostActivity("decks", scenarioName(scenario));
      const loaded = loadedPacks();
      const allowedPacks = loaded.filter((p) => input.allowed.some((m) => m.id === p.id && m.version === p.version));
      return deckWorker.check(input, loaded, withRequiredPacks(allowedPacks, loaded));
    },
    mapSeats: seatMappingAt,
    start: async (config) => {
      reportHostActivity("starting", scenarioName(scenario));
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

/** Seat n plays engine player p<n> (setup's player order is the lobby's seat order). */
const seatMappingOf = (now: RoomState): LobbySeatSpec[] =>
  now.seats.map((s, index) => ({ id: s.id, label: s.label, player: `p${index + 1}` }));
const seatsMapped = (now: RoomState): boolean => now.seats.every((s, index) => s.player === `p${index + 1}`);

/** How long the host waits for the room to accept the seat to player mapping. */
const MAPPING_TIMEOUT_MS = 5_000;

/** Resolves true once `done(state)` holds (now, or on a later room state), false after `ms`. */
function waitForRoomState(done: (state: RoomState) => boolean, ms: number): Promise<boolean> {
  if (done(state)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      listeners.delete(listener);
      resolve(ok);
    };
    const listener = (next: RoomState) => {
      if (done(next)) finish(true);
    };
    const timer = setTimeout(() => finish(false), ms);
    listeners.add(listener);
  });
}

/**
 * The lobby revision to start a game at, once the room's seats show the seat to player mapping the decks were judged
 * against (`judgedRev`); null when the lobby moved on instead. Mapped already: no write, the same revision. Otherwise a
 * compare and swap on `judgedRev` (the room applies it only to that very lobby, so success is exactly one higher; a
 * refusal or a higher revision is another change this start never judged), awaited for its acknowledgement.
 */
export async function seatMappingAt(judgedRev: number): Promise<number | null> {
  if (state.rev !== judgedRev) return null;
  if (seatsMapped(state)) return judgedRev;
  const refusals = state.refusal?.seq ?? 0;
  setLobby({ ifRev: judgedRev, seats: seatMappingOf(state) });
  const settled = (now: RoomState): boolean =>
    (seatsMapped(now) && now.rev === judgedRev + 1) ||
    now.rev > judgedRev + 1 ||
    (now.refusal !== null && now.refusal.seq > refusals && now.refusal.reason === "lobby-changed");
  if (!(await waitForRoomState(settled, MAPPING_TIMEOUT_MS))) return null;
  return seatsMapped(state) && state.rev === judgedRev + 1 ? judgedRev + 1 : null;
}

/**
 * Host only: starts the game on this device, watchable, and streams it into the room over the lobby's own socket. The
 * returned promise is the engine's `start` (the UI then moves to the board as for any new game).
 */
export async function startGame(config: SessionConfig): Promise<void> {
  const playMode = state.settings?.playMode;
  // Seat n plays engine player p<n> (setup's player order is the lobby's seat order): the room keeps it for the
  // proposals it forwards, and drops it from any later seat list that omits it.
  // A start that carries `roomLobbyRev` has its mapping written (compare and swap) by `seatMappingAt` before this; one
  // without it writes only when the room's seats do not already show the mapping, as a write bumps the lobby revision.
  if (
    config.roomLobbyRev === undefined &&
    state.role === "host" &&
    state.seats.length > 0 &&
    (!state.started || state.gameOver) &&
    !seatsMapped(state)
  ) {
    setLobby({ seats: seatMappingOf(state) });
  }
  await appSession().store.start({
    ...config,
    watchable: true,
    ...(state.roomId ? { room: state.roomId } : {}),
    ...(playMode ? { roomPlayMode: playMode } : {}),
    // Strict forces Off; a lobby without the setting (an older Worker) reads as its mode's default.
    ...(playMode ? { roomUndo: lobbyUndoFor(playMode, state.settings?.undo) } : {}),
    ...(state.settings?.cheats === true ? { roomCheats: true } : {}),
    // Always: the live header carries it, so a watcher's board keeps every hand face down. "Host sees every hand" opens
    // hands for the host's own board alone (#887).
    roomHandsHidden: true as const,
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
      await host.watch(roomId, syncUrl, loadedPacks(), channel.port2, false, () => ({
        tableId: state.tableId,
        gid: state.gid,
      }));
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
    epicTableConfig(config, state.epic, {
      roomId: state.roomId,
      ...(playMode ? { playMode } : {}),
      ...(state.settings?.cheats === true ? { cheats: true } : {}),
    }),
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

// ---------------------------------------------------------------------------------------------------------------
// Civil War Competitive (issue #883, docs/live-game-rooms.md section 11). The state is `RoomState.competitive` and each
// seat's `team`. One table, two teams (1v1 or 2v2); each team builds a scenario for the other and seals it in the room.

/** Host only: Competitive mode with these seats (each naming its `team`) and, optionally, the tie-break option. */
export function setCompetitive(seats: readonly LobbySeatSpec[], tieBreaks?: boolean): void {
  postRoomCommand({ kind: "room-competitive", seats, ...(tieBreaks === undefined ? {} : { tieBreaks }) });
}

/** Puts a seat on a team: the host may for any seat, a participant for a seat they hold. Locked once the game runs. */
export function setTeam(seat: string, team: TeamId): void {
  postRoomCommand({ kind: "room-team", seat, team });
}

/**
 * Seals the scenario my team built for the other team in the room (`team` defaults to my team; a host who holds no
 * seat names it). The scenario goes to the room worker and the room's private storage and is never put in
 * `RoomState`, echoed to any other device, or kept on the main thread: only the host's `startCompetitive` ever receives
 * both, at Start. A new submission takes the team's ready back.
 */
export function submitScenario(
  submission: unknown,
  team: TeamId | undefined = state.competitive?.myTeam ?? undefined,
): void {
  if (team === undefined) return;
  postRoomCommand({ kind: "room-scenario", team, scenario: submission });
}

/** A team says it is ready (it needs a sealed scenario) or takes it back; `team` defaults to mine. */
export function setTeamReady(ready: boolean, team: TeamId | undefined = state.competitive?.myTeam ?? undefined): void {
  if (team === undefined) return;
  postRoomCommand({ kind: "room-team-ready", team, ready });
}

/** Host only: the tie-break option (default on, plan Q9 C): when both teams win in the window, apply the printed order, or call a tie. */
export function setTieBreaks(on: boolean): void {
  postRoomCommand({ kind: "room-tiebreaks", on });
}

export type StartCompetitiveResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      /**
       * `not-host`, `not-ready` (see `RoomState.competitive.canStart`), `unavailable` (no room worker, or the room did not
       * answer the reveal in time), or `room` (the seats' decks, as for any room: `result` says what stopped it, in the
       * words `startResultWords` gives).
       */
      readonly reason: "not-host" | "not-ready" | "unavailable";
    }
  | { readonly ok: false; readonly reason: "room"; readonly result: Exclude<RoomStartResult, { readonly ok: true }> };

/** How long the host waits for the room to answer a reveal. */
const REVEAL_TIMEOUT_MS = 10_000;

/** A reveal waiting for the room's answer: a second call shares it rather than replacing the listener. */
let revealing: Promise<Reveal | null> | null = null;

/** Both sealed scenarios and the room's competitive revision (`CompetitiveState.rev`) they were revealed at. */
interface Reveal {
  readonly sealed: SealedScenarios;
  readonly rev: number;
}

/** Asks the room for both sealed scenarios, once; the room answers the host's worker, which posts them here. */
function revealSealed(): Promise<Reveal | null> {
  revealing ??= askForSealed().finally(() => {
    revealing = null;
  });
  return revealing;
}

function askForSealed(): Promise<Reveal | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      setSealedListener(null);
      resolve(null);
    }, REVEAL_TIMEOUT_MS);
    setSealedListener(({ rev, ...sealed }) => {
      clearTimeout(timer);
      setSealedListener(null);
      resolve({ sealed, rev });
    });
    if (!postRoomCommand({ kind: "room-reveal" })) {
      clearTimeout(timer);
      setSealedListener(null);
      resolve(null);
    }
  });
}

/** What the host picks for a Competitive game besides the seats' decks. */
export interface CompetitiveStartOptions {
  readonly seed: number;
  /** The table agreed on expert leaders (Q13 A). */
  readonly expert?: boolean;
}

/**
 * Host only: starts the two-team game once both teams are ready (`RoomState.competitive.canStart`). The room checks the
 * team sizes and readiness again and hands this device both sealed scenarios, which only now leave the room. Each
 * seat's own deck then goes through the same path as any room (`startRoomGame`: fetched from the room, judged in a
 * worker, a refusal told to that seat's holder alone), plus the Competitive rule that a hero may not share a title with
 * its own team's leader (MC56 pp. 14, 16), and the decks become the two-team `SessionConfig`
 * (`live/competitive-start.ts`); every other seat proposes to this engine, as in a standard room.
 */
export async function startCompetitive(options: CompetitiveStartOptions): Promise<StartCompetitiveResult> {
  const competitive = state.competitive;
  if (state.role !== "host") return { ok: false, reason: "not-host" };
  if (!competitive?.canStart) return { ok: false, reason: "not-ready" };
  const revealed = await revealSealed();
  if (!revealed) return { ok: false, reason: "unavailable" };
  const { sealed } = revealed;
  // The reveal belongs to one revision of the teams, readiness and scenarios. If the room moved past it (a team took its
  // ready back, changed seats or sealed another scenario), these scenarios are not what the table agreed to start.
  const stale = (): boolean => {
    const now = state.competitive;
    // The teams, tie-breaks and seat order below come from the snapshot taken before the reveal, so the reveal must be
    // for that very revision: a newer one (a swap and a second ready while it was in flight) means start again.
    return !now?.canStart || now.rev !== revealed.rev || revealed.rev !== competitive.rev;
  };
  if (stale()) return { ok: false, reason: "not-ready" };
  // Seats play engine players in team order (registration first, `competitiveSeatOrder`); the proposal judge reads the teams.
  // Every seat is on a team by now (`canStart` says so); a seat with none gets no player rather than another seat's.
  const order = competitiveSeatOrder(state);
  const teams = { registration: competitive.teams.registration.seats, resistance: competitive.teams.resistance.seats };
  const begin = async (config: SessionConfig): Promise<void> => {
    // The seats' decks were fetched and judged since the reveal: re-check before anything is built or launched.
    if (stale()) throw new Error("the teams or scenarios changed while the game was starting");
    // The decks were judged at `config.roomLobbyRev`; the room must still be at it.
    if (config.roomLobbyRev !== undefined && state.rev !== config.roomLobbyRev)
      throw new Error("the room changed while the game was starting");
    const built = buildCompetitiveConfig({
      setup: {
        seed: options.seed,
        ...(options.expert ? { expert: true } : {}),
        seats: order.map((seat, index) => ({ seat, player: config.players[index]! })),
      },
      sealed,
      teams,
      tieBreaks: competitive.tieBreaks,
    });
    if (!built) throw new Error("a sealed scenario does not read, or a team has no player for a seat");
    // The room judges guest proposals by this seat to player mapping, so the engine starts only once the room's own
    // lobby shows it (registration first, which is not always the lobby's seat order).
    const mapped = (now: RoomState): boolean =>
      now.seats.every(
        (s) => (s.player ?? undefined) === (order.includes(s.id) ? `p${order.indexOf(s.id) + 1}` : undefined),
      );
    let startRev = state.rev;
    if (!mapped(state)) {
      // Compare and swap on the revision the decks were judged at: the room applies the mapping only to that very lobby,
      // so on success its revision is exactly one higher, and anything else (a refusal, a higher revision) is another
      // change this start never judged. A deck summary is not proof that it is the deck that was judged.
      const judgedRev = state.rev;
      const refusals = state.refusal?.seq ?? 0;
      setLobby({
        ifRev: judgedRev,
        seats: state.seats.map((s) => ({
          id: s.id,
          label: s.label,
          ...(order.includes(s.id) ? { player: `p${order.indexOf(s.id) + 1}` } : {}),
        })),
      });
      const settled = (now: RoomState): boolean =>
        (mapped(now) && now.rev === judgedRev + 1) ||
        now.rev > judgedRev + 1 ||
        (now.refusal !== null && now.refusal.seq > refusals && now.refusal.reason === "lobby-changed");
      if (!(await waitForRoomState(settled, MAPPING_TIMEOUT_MS)))
        throw new Error("the room did not accept the seat order");
      if (!mapped(state) || state.rev !== judgedRev + 1)
        throw new Error("the lobby changed while the game was starting");
      startRev = judgedRev + 1;
    }
    if (stale()) throw new Error("the teams or scenarios changed while the game was starting");
    const playMode = state.settings?.playMode;
    await appSession().store.start({
      ...built,
      roomLobbyRev: startRev,
      watchable: true,
      ...(state.roomId ? { room: state.roomId } : {}),
      ...(playMode ? { roomPlayMode: playMode } : {}),
      roomTeams: roomTeamsOf(state),
      localSeats: localPlayersOf(state),
    });
  };
  const cards = currentCardsById();
  const competitiveBase: RoomGameBase = { scenarioId: "", difficulty: "standard", seed: options.seed };
  const result = await runRoomStart(competitiveBase, {
    ...roomStartDeps(begin, competitiveBase),
    seatIds: order,
    extraCheck: (decks) =>
      leaderClashRefusals({
        teams,
        heroes: new Map([...decks].map(([seat, deck]) => [seat, deck.hero] as const)),
        sealed,
        leaderName: (id) => {
          const villain = POOL_SCENARIOS.find((s) => s.id === id)?.villainCardId;
          return villain === undefined ? undefined : cards.get(villain as string)?.name;
        },
        card: (id) => cards.get(id),
      }),
  });
  return result.ok ? { ok: true } : { ok: false, reason: "room", result };
}
