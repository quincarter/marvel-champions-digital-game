/**
 * The app's one session: the engine host, the store, and the settings.
 *
 * Scenes reach for this rather than constructing a host of their own, so there
 * is exactly one engine and exactly one store in the app — the "one store, one
 * dispatch" rule from PLAN.md Phase 4.
 */

import { createEngineHost } from "./engine/create-host.js";
import { MemoryDeckStorage, type DeckStorage } from "./engine/deck-storage.js";
import type { EngineHost } from "./engine/host.js";
import { IdbDeckStorage } from "./engine/idb-deck-storage.js";
import { SessionStore } from "./store/session-store.js";
import { defaultSettings, type Settings } from "./settings.js";

export interface AppSession {
  readonly host: EngineHost;
  readonly store: SessionStore;
  settings: Settings;
}

let session: AppSession | null = null;

export function appSession(): AppSession {
  if (!session) {
    const host = createEngineHost();
    session = { host, store: new SessionStore(host), settings: defaultSettings() };
  }
  return session;
}

/**
 * Where imported and user-built decks live (PLAN.md Phase 9). A separate
 * concern from `appSession`'s engine host on purpose: decks aren't game
 * state, are read and written from the main thread (Title, Decks, the
 * builder), and live in their own `mc-decks` database
 * (`engine/deck-storage.ts`) rather than riding along with a game session.
 *
 * `IndexedDB` only exists in a real browser (or a test that opts in with
 * `fake-indexeddb/auto`); everywhere else — plain Vitest, SSR-less tooling —
 * falls back to the in-memory store, the same guard `LocalEngineHost` uses
 * for game storage.
 */
let decks: DeckStorage | null = null;

export function deckStorage(): DeckStorage {
  decks ??= typeof indexedDB !== "undefined" ? new IdbDeckStorage() : new MemoryDeckStorage();
  return decks;
}
