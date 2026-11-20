/**
 * Playing the room's game from a seat (issue #881, docs/live-game-rooms.md section 9): the main thread's part for a
 * guest who holds a seat. Once the room's game has started, `playRoomGame()` opens it as a `SeatEngineHost` (the seat
 * worker follows the room's log with the whole engine and proposes this device's moves to the host), or, for a guest
 * with no seat that may act, as the watch view (`watchRoomGame()`), exactly as before.
 *
 * `enterSeatGame(host)` then puts the host on the app's session the way a replay does (`replay/replay-mode.ts`): the
 * board and every scene over it read `appSession()`, so while a seat is up its host and store are the seat's, and
 * `leaveSeatGame()` puts the device's own back. A seat never writes or reads a saved game: this device does not keep
 * the room's game as its own.
 *
 * Which heroes the device acts for follows the room: a seat counts while it is mine, not mismatched and not taken over
 * by the host. When that set changes (the host takes a seat over or gives it back, a seat is assigned or released) the
 * seat host is told, and the board shows the new set of heroes as interactive without reloading.
 */
import type { MessageKey } from "../i18n/translate.js";
import type { EngineHost } from "../engine/host.js";
import { heroesOfSeats, sameHeroes } from "../live/seat-heroes.js";
import { SeatEngineHost, WorkerSeatBackend } from "../live/seat-host.js";
import type { SeatBackend } from "../live/seat-protocol.js";
import { watchFailureKey } from "../live/watch-open.js";
import type { RoomState } from "../live/room-state.js";
import { loadedPacks } from "../packs/pack-registry.js";
import { startupPacksLoaded, startupPacksPending } from "../packs/startup-packs.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { ReplayHost } from "../replay/replay-host.js";
import { appSession, swapSessionHost, type AppSession } from "../session.js";
import { SessionStore } from "../store/session-store.js";
import type { LiveRoomIn } from "../live/live-room-protocol.js";
import { onRoomState, roomState, watchRoomGame } from "./room.js";
import { postRoomCommand, setSeatLeaver } from "./live-watch.js";

export type PlayRoomGame =
  /** A seat that may act: hand `host` to `enterSeatGame`. */
  | { readonly ok: true; readonly kind: "seat"; readonly host: SeatEngineHost }
  /** No seat that may act (none, or only mismatched or taken-over ones): the room's game as a live watch. */
  | { readonly ok: true; readonly kind: "watch"; readonly host: ReplayHost }
  | { readonly ok: false; readonly message: MessageKey };

export interface SeatPlayDeps {
  readonly roomState: () => RoomState;
  /** Posts to the room worker; false where there is none. */
  readonly post: (message: LiveRoomIn, transfer?: Transferable[]) => boolean;
  readonly makeBackend: (feed: MessagePort, packs: readonly PackRuntime[]) => SeatBackend;
  readonly packs: () => readonly PackRuntime[];
  readonly packsPending: () => boolean;
  readonly packsLoaded: () => Promise<void>;
  readonly watch: typeof watchRoomGame;
}

const defaultDeps: SeatPlayDeps = {
  roomState,
  post: postRoomCommand,
  makeBackend: (feed, packs) => new WorkerSeatBackend(feed, packs),
  packs: loadedPacks,
  packsPending: startupPacksPending,
  packsLoaded: startupPacksLoaded,
  watch: watchRoomGame,
};

/**
 * Guest only, once `state.started`: opens the room's game for this device to play from its seats. Never throws; a
 * failure is a message key to show. Falls back to the watch view for a guest who has nothing to act for.
 */
export async function playRoomGame(deps: SeatPlayDeps = defaultDeps): Promise<PlayRoomGame> {
  const state = deps.roomState();
  if (state.role !== "guest" || !state.roomId) return { ok: false, message: "watch.link.gone" };
  const heroes = heroesOfSeats(state);
  if (heroes.length === 0) {
    const watched = await deps.watch();
    return watched.ok ? { ok: true, kind: "watch", host: watched.host } : watched;
  }
  if (deps.packsPending()) await deps.packsLoaded();
  const channel = new MessageChannel();
  // The room worker follows this end for the log and carries the seat's proposals; the seat worker holds the other.
  if (!deps.post({ kind: "room-follow", port: channel.port1 }, [channel.port1]))
    return { ok: false, message: "watch.link.gone" };
  const host = new SeatEngineHost(deps.makeBackend(channel.port2, deps.packs()), {
    // Concede from a seat is leaving it (the game goes on): every seat this device holds is released.
    leaveSeats: () => {
      for (const seat of deps.roomState().mySeats) deps.post({ kind: "room-seat", op: "release", seat });
    },
  });
  const dispose = host.dispose.bind(host);
  host.dispose = () => {
    deps.post({ kind: "room-unfollow" });
    dispose();
  };
  try {
    await host.join();
    await host.setPlayers(heroes);
    return { ok: true, kind: "seat", host };
  } catch (cause) {
    host.dispose();
    return { ok: false, message: watchFailureKey(cause) };
  }
}

interface Seated {
  readonly seat: SeatEngineHost;
  /** What the session had before: put back on leaving. */
  readonly host: EngineHost;
  readonly store: SessionStore;
  readonly gameLog: AppSession["gameLog"];
  readonly villainReview: AppSession["villainReview"];
  readonly stopTracking: () => void;
}

let seated: Seated | null = null;

/** The seat's host while the board shows the room's game from a seat, else null. */
export function activeSeat(): SeatEngineHost | null {
  return seated?.seat ?? null;
}

/**
 * Puts an opened seat on the session and publishes its table: a scene started after this (the board) plays the room's
 * game. Replaces a seat already up. `rooms` is the stream of the room's states (the heroes follow it).
 */
export async function enterSeatGame(
  host: SeatEngineHost,
  rooms: (listener: (state: RoomState) => void) => () => void = onRoomState,
): Promise<SessionStore> {
  if (seated) leaveSeatGame();
  const store = new SessionStore(host);
  const { gameLog, villainReview } = appSession();
  const previous = swapSessionHost(host, store);
  let held = heroesOfSeats(roomState());
  const stopTracking = rooms((state) => {
    const next = heroesOfSeats(state);
    if (sameHeroes(held, next)) return;
    held = next;
    void host.setPlayers(next).catch(() => undefined);
  });
  seated = { seat: host, ...previous, gameLog, villainReview, stopTracking };
  // The Title ends a room's game for a guest too: it puts the seat away through this (`leaveRoomAtTitle`).
  setSeatLeaver(leaveSeatGame);
  try {
    // Not `resume`: that syncs a saved game first, and the room's game is no save of this device's.
    await store.open();
  } catch (cause) {
    leaveSeatGame();
    throw cause;
  }
  if (store.state.status === "failed") {
    const error = store.state.error ?? "the room's game could not be shown";
    leaveSeatGame();
    throw new Error(error);
  }
  return store;
}

/** Puts the device's own host and store back and closes the seat (its worker with it). Nothing to do when none is up. */
export function leaveSeatGame(): void {
  const current = seated;
  if (!current) return;
  seated = null;
  setSeatLeaver(null);
  current.stopTracking();
  const { store } = swapSessionHost(current.host, current.store);
  const session = appSession();
  session.gameLog = current.gameLog;
  session.villainReview = current.villainReview;
  store.dispose();
  current.seat.dispose();
}
