/**
 * The real device-sync service for this app, built once: the saved recovery code in `localStorage`, this device's
 * save data in IndexedDB, and the sync Worker. `main.ts` calls `startDeviceSync` at boot; any screen reaches the same
 * object through `syncService()`.
 *
 * Game writes happen in the engine Web Worker, whose `notifySaveDataChanged` never reaches this thread, so the worker
 * posts a `saved` message once its writes have committed and `engine/worker-host.ts` relays it (reason "turn" for a
 * command that ended a turn). Decks and campaigns are written on this thread and notify for themselves. Every game-only
 * trigger still re-reads the whole snapshot (non-game records are hashed again): cheap at this size, not yet cached.
 */
import { CARDS_BY_ID, POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import { appSession } from "../session.js";
import { setBeforeResume } from "../store/resume-hook.js";
import { cardDisplayName } from "../view/hero-names.js";
import { gameLabelOf, type ContinueLabelNames } from "../view/continue-label.js";
import type { SessionConfig } from "../engine/host.js";
import { reloadGuidePrefsFromStorage } from "../guide/guide-store.js";
import { dropUnlockCaches, refreshUnlocks } from "../progression/progression.js";
import { OpenGameTracker } from "./open-game.js";
import { emitSyncApplied } from "./sync-events.js";
import { IdbLocalSaveData } from "./sync-local.js";
import { SyncService } from "./sync-service.js";
import { IdbSyncStateStore } from "./sync-state.js";

let service: SyncService | null = null;
/** Whether a game is on the table or being dealt right now (set by `main.ts`, which can see the scenes). */
let gameOnScreen: () => boolean = () => true;
/** The game Continue is opening, held until the table has been and gone (`sync/open-game.ts`). */
const openGame = new OpenGameTracker();

/** Names for a game's label, from content (never from the save's own text). */
const NAMES: ContinueLabelNames = {
  scenarioName: (id) => POOL_SCENARIOS.find((candidate) => (candidate.id as string) === id)?.name,
  identityName: (id) => {
    const identity = CARDS_BY_ID.get(id);
    return identity ? cardDisplayName(identity) : undefined;
  },
  starterDeckName: (id) => POOL_STARTER_DECKS.find((deck) => (deck.id as string) === id)?.name,
};

/** A synced game's name from its meta record ("Rhino · Spider-Man"), or null when the meta has no setup. */
export function describeGameMeta(meta: unknown): string | null {
  const config = (meta as { config?: SessionConfig } | null)?.config;
  if (!config || !Array.isArray(config.players)) return null;
  try {
    return gameLabelOf(config, NAMES);
  } catch {
    return null;
  }
}

/** The one service. Built on first use, so a player who never opens sync pays nothing for it. */
export function syncService(): SyncService {
  service ??= new SyncService({
    storage: localStorage,
    local: new IdbLocalSaveData({
      indexedDB,
      localStorage,
      // The game on the table is never overwritten by a sync; once the player leaves the table it is fair game again.
      openGameId: () => openGame.current(gameOnScreen(), appSession().store.state.gameId),
    }),
    state: new IdbSyncStateStore(),
    describeGame: describeGameMeta,
    // A conflict about another game is not put to the player mid-game: it waits until they leave the table.
    onTable: () => gameOnScreen(),
    document,
    window,
  });
  return service;
}

/**
 * Boot: starts the service and makes Continue check the other devices first.
 * `onTable` says whether a game is on screen (the Board or its deal), so sync leaves that one alone.
 */
export function startDeviceSync(onTable: () => boolean): void {
  gameOnScreen = onTable;
  const sync = syncService();
  setBeforeResume(async (gameId) => {
    const result = await sync.syncBeforeResume(gameId);
    // From here until the table has been and gone, sync leaves this game to its session.
    openGame.begin(gameId);
    return result;
  });
  // Records another device changed were written under the in-memory copies of unlocks and guide prefs: read them again
  // so the next local edit builds on what is stored, then tell the screens that list saves.
  sync.onApplied(() => {
    reloadGuidePrefsFromStorage();
    dropUnlockCaches();
    void refreshUnlocks().catch(() => false);
    emitSyncApplied();
  });
  // Leaving the table: questions put off while playing are asked now (a sync raises them again), and so are the
  // remote changes the open game was waiting for.
  let wasOnTable = false;
  setInterval(() => {
    const now = gameOnScreen();
    openGame.observe(now);
    if (wasOnTable && !now && sync.isOn()) {
      sync.takeHeldConflicts();
      void sync.syncNow();
    }
    wasOnTable = now;
  }, 1000);
  void sync.start();
}
