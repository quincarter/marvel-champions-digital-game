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
import { clearPopoutToken, PopoutRearm, savePopoutToken } from "./chat-popout-token.js";
import { syncRoomAddress } from "./room-address.js";
import { syncGameAddress } from "./game-address.js";
import type { SessionConfig } from "../engine/host.js";
import type { HostActivityStep } from "@mc/sync-worker/room-protocol";
import { roomDraft, setRoomDraftListener } from "../view/room-table-setup.js";
import type { SetupDraft } from "../view/setup-draft.js";
import { tablePlanOf } from "../view/room-table-plan.js";
import type { TablePlan } from "../live/room-state.js";
import type { MessageKey } from "../i18n/translate.js";
import { currentScenarios } from "../content/pool.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { startupPacksLoaded, startupPacksPending } from "../packs/startup-packs.js";
import type { ReplayHost } from "../replay/replay-host.js";
import { ReplayHost as ReplayHostClass, WorkerReplayBackend } from "../replay/replay-host.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { appSession } from "../session.js";
import { cleanOnlineName } from "../settings.js";
import { loadLiveWatch, type WatchOpenDeps } from "../live/watch-open.js";
import {
  NO_ROOM,
  type LobbySeatSpec,
  type LobbySettingsPatch,
  type RoomState,
  type SeatDeckEntry,
} from "../live/room-state.js";
import { RoomDeckWorker } from "../live/room-deck-check-client.js";
import { withRequiredPacks } from "../packs/pack-runtime.js";
import { startRoomGame as runRoomStart, type RoomGameBase, type RoomStartResult } from "../live/room-start.js";
import type { DeckOption } from "../view/deck-list-model.js";
import { postRoomCommand, setChatPopoutListener, setRoomDecksListener, setRoomStateListener } from "./live-watch.js";

export type { RoomState } from "../live/room-state.js";

let state: RoomState = NO_ROOM;
const listeners = new Set<(state: RoomState) => void>();

/** The last host activity sent to the room (step and scenario), forgotten on leaving it. */
let lastActivity: { readonly step: HostActivityStep; readonly scenario?: string } | null = null;
/** A dropped socket cleared the room's copy of it: it is sent again once the room is back. */
let resendActivity = false;
/** The table plan the host last published (null when none), sent again when the room socket comes back. */
let lastPlan: TablePlan | null = null;
let resendPlan = false;

function publish(next: RoomState): void {
  const prev = state;
  state = next;
  if (next.role === "host" && next.connection === "connected" && lastPlan) {
    // The room cleared the plan (the game started): the host's copy of what it sent is stale, so a rematch's lobby sends
    // the kept draft again (`resyncTablePlan`).
    if (prev.tablePlan && !next.tablePlan) lastPlan = null;
    // The room refused something as over the limit, so the plan may not have gone out: forget it and try again shortly.
    else if (next.refusal?.reason === "rate-limited" && next.refusal.seq !== prev.refusal?.seq) {
      lastPlan = null;
      setTimeout(resyncTablePlan, PLAN_RETRY_MS);
    }
  }
  if (
    next.role === "none" ||
    next.connection === "idle" ||
    next.connection === "connecting" ||
    next.connection === "ended"
  ) {
    lastActivity = null;
    resendActivity = false;
    lastPlan = null;
    resendPlan = false;
  } else if (next.connection === "reconnecting") {
    resendActivity = true;
    resendPlan = true;
  } else if (next.connection === "connected" && resendPlan) {
    resendPlan = false;
    if (next.role === "host" && lastPlan) postRoomCommand({ kind: "room-table-plan", plan: lastPlan });
  }
  if (next.connection === "connected" && resendActivity) {
    resendActivity = false;
    if (next.role === "host" && lastActivity) {
      const { step, scenario } = lastActivity;
      postRoomCommand({ kind: "room-activity", step, ...(scenario ? { scenario } : {}) });
    }
  }
  if (next.connection === "ended" && next.code && roomIsOver(next.problem)) forgetRoom(next.code);
  // `?room=<CODE>` follows the room, whichever way it was entered (hosted, typed code, link, recent room, reload).
  syncRoomAddress(next);
  // This tab's open pop-out window finds its way back to the new worker after a reload (`chat-popout-token.ts`).
  popoutRearm.onState(next);
  // A host whose room closed under a game in progress keeps playing it alone: the game takes the address at once.
  if (next.connection === "ended" && prev.role === "host" && prev.started) {
    const session = appSession();
    const store = session?.store;
    if (store) syncGameAddress(store.state, session.guidedRun);
  }
  for (const listener of [...listeners]) listener(state);
}

setRoomStateListener(publish);

const popoutRearm = new PopoutRearm((token) => void postRoomCommand({ kind: "chat-popout-arm", token }));

let chatPopout = false;
const popoutListeners = new Set<(open: boolean) => void>();

setChatPopoutListener((open) => {
  // A window that closed (or was brought back) no longer needs its token kept for a reload.
  if (chatPopout && !open) clearPopoutToken();
  chatPopout = open;
  for (const listener of [...popoutListeners]) listener(open);
});

/** Whether the chat is open in its own window (`live/chat-popout-protocol.ts`). */
export const chatPopoutOpen = (): boolean => chatPopout;

/** Calls `listener` with the pop-out's state at once, then whenever its window opens or goes away. Returns the unsubscribe. */
export function onChatPopout(listener: (open: boolean) => void): () => void {
  popoutListeners.add(listener);
  listener(chatPopout);
  return () => popoutListeners.delete(listener);
}

/** Arms this tab's room worker for a pop-out window that carries `token` (call before opening the window). */
export function armChatPopout(token: string): void {
  // Kept for this tab (sessionStorage) so the window survives a reload of this page.
  if (state.roomId) savePopoutToken(state.roomId, token);
  postRoomCommand({ kind: "chat-popout-arm", token });
}

/** Brings the chat back from its window: the window closes and the lobby shows the chat again. */
export function recallChatPopout(): void {
  clearPopoutToken();
  postRoomCommand({ kind: "chat-popout-recall" });
}

/**
 * Host only: publishes the table the host picked (null clears it) so the lobby shows it to everyone. Memory only in the
 * room; a dropped socket makes `publish` send the last plan again.
 */
export function reportTablePlan(plan: TablePlan | null): void {
  if (state.role !== "host" || state.connection === "idle") return;
  if (JSON.stringify(plan) === JSON.stringify(lastPlan)) return;
  if (postRoomCommand({ kind: "room-table-plan", plan })) lastPlan = plan;
}

/** The room's plan limit refills one send every two seconds. */
const PLAN_RETRY_MS = 2500;

const planOfDraft = (draft: SetupDraft | null): TablePlan | null => {
  if (!draft) return null;
  const scenario = currentScenarios().find((s) => (s.id as string) === (draft.scenarioId as string));
  return tablePlanOf(draft, scenario);
};

setRoomDraftListener((draft) => reportTablePlan(planOfDraft(draft)));

/**
 * Host only: sends the kept draft's plan when the room is not showing it (a rematch's lobby after the room cleared it at
 * game start, or a send the room refused). Does nothing when there is no kept draft or the room already has the plan.
 */
export function resyncTablePlan(): void {
  if (state.role !== "host" || state.connection !== "connected" || lastPlan !== null) return;
  const plan = planOfDraft(roomDraft());
  if (plan && JSON.stringify(plan) !== JSON.stringify(state.tablePlan)) reportTablePlan(plan);
}

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

/** Calls `listener` with the current state at once, then on every change. Returns the unsubscribe. */
export function onRoomState(listener: (state: RoomState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
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

/**
 * Back into the room the address names (`?room=<CODE>`, see `room-address.ts`) after a reload: the host with its saved
 * host token, otherwise a guest with its seat tokens. `name` as for `joinRoom`; empty: `problem: "no-name"`.
 */
export async function rejoinRoom(code: string, name?: string): Promise<void> {
  publish({ ...NO_ROOM, role: "guest", connection: "connecting" });
  if (!postRoomCommand({ kind: "room-rejoin", code, name: nameFor(name) })) unavailable("guest");
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
export async function startRoomGame(base: RoomGameBase): Promise<RoomStartResult> {
  const scenario = base.scenarioId as string | undefined;
  const result = await runRoomStart(base, {
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
    start: async (config) => {
      reportHostActivity("starting", scenarioName(scenario));
      await startGame(config);
      const { store } = appSession();
      return store.state.status === "failed" ? (store.state.error ?? "failed") : null;
    },
  });
  // A start that did not deal the game leaves the host in the lobby: the status line is over (a game that started
  // already cleared it in the room).
  if (!result.ok) reportHostActivity("idle");
  return result;
}

/**
 * Host only: starts the game on this device, watchable, and streams it into the room over the lobby's own socket. The
 * returned promise is the engine's `start` (the UI then moves to the board as for any new game).
 */
export async function startGame(config: SessionConfig): Promise<void> {
  const playMode = state.settings?.playMode;
  await appSession().store.start({
    ...config,
    watchable: true,
    ...(state.roomId ? { room: state.roomId } : {}),
    ...(playMode ? { roomPlayMode: playMode } : {}),
    // Strict forces Off; a lobby without the setting (an older Worker) reads as its mode's default.
    ...(playMode ? { roomUndo: lobbyUndoFor(playMode, state.settings?.undo) } : {}),
    ...(state.settings?.cheats === true ? { roomCheats: true } : {}),
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
