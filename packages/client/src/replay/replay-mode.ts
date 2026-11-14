/**
 * Watching a replay on the board (issue #693). The board and every scene over it read the app's one session
 * (`appSession()`): while a replay is up, its host and store are the replay's, and leaving puts the game's own back
 * exactly as they were. The replay's host refuses every command (`ReplayHost.dispatch`), so even a control the board
 * forgot to hide cannot reach a game.
 *
 * A replay is only entered with no game being played (from the title, the games list or Game over), and the live
 * host is never disposed or written to while it is set aside.
 */
import type { EngineHost } from "../engine/host.js";
import { appSession, swapSessionHost, type AppSession } from "../session.js";
import { SessionStore } from "../store/session-store.js";
import type { ReplayHost } from "./replay-host.js";

interface Watching {
  readonly replay: ReplayHost;
  /** What the session had before: put back on leaving. */
  readonly host: EngineHost;
  readonly store: SessionStore;
  /** The game's own log and last villain phase, which the replay's board overwrites: a bug report reads them after. */
  readonly gameLog: AppSession["gameLog"];
  readonly villainReview: AppSession["villainReview"];
}

let watching: Watching | null = null;

/** The replay being watched, or null while the board shows a game. */
export function activeReplay(): ReplayHost | null {
  return watching?.replay ?? null;
}

/**
 * Puts an opened replay on the session and publishes its first position: a scene started after this (the board) draws
 * the replay. Replaces a replay already being watched.
 */
export async function enterReplay(replay: ReplayHost): Promise<SessionStore> {
  if (watching) leaveReplay();
  const store = new SessionStore(replay);
  const { gameLog, villainReview } = appSession();
  const previous = swapSessionHost(replay, store);
  watching = { replay, ...previous, gameLog, villainReview };
  try {
    // Not `resume`: that syncs the game first, and a replay is no game of the device's.
    await store.open();
  } catch (cause) {
    leaveReplay();
    throw cause;
  }
  // `open` records a failure on the store rather than throwing: the board must not open on a replay that isn't there.
  if (store.state.status === "failed") {
    const error = store.state.error ?? "the replay could not be shown";
    leaveReplay();
    throw new Error(error);
  }
  return store;
}

/** Puts the game's own host and store back and closes the replay (its worker with it). Nothing to do when none is up. */
export function leaveReplay(): void {
  const current = watching;
  if (!current) return;
  watching = null;
  const { store } = swapSessionHost(current.host, current.store);
  const session = appSession();
  session.gameLog = current.gameLog;
  session.villainReview = current.villainReview;
  store.dispose();
  current.replay.dispose();
}
