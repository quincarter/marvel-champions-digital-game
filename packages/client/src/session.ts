/**
 * The app's one session: the engine host, the store, and the settings.
 *
 * Scenes reach for this rather than constructing a host of their own, so there
 * is exactly one engine and exactly one store in the app — the "one store, one
 * dispatch" rule from PLAN.md Phase 4.
 */

import { createEngineHost } from "./engine/create-host.js";
import type { EngineHost } from "./engine/host.js";
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
