/**
 * The app's one session: the engine host, the store, and the settings.
 *
 * Scenes reach for this rather than constructing a host of their own, so there
 * is exactly one engine and exactly one store in the app — the "one store, one
 * dispatch" rule from PLAN.md Phase 4.
 */

import { campaignDefinitionOf } from "@mc/cards";
import type { CampaignDefinition } from "@mc/engine";
import { CampaignService } from "./campaign/campaign-service.js";
import { POOL_CARDS, POOL_DEPS } from "./content/pool.js";
import { MemoryCampaignStorage } from "./engine/campaign-storage.js";
import { createEngineHost } from "./engine/create-host.js";
import { IdbCampaignStorage } from "./engine/idb-campaign-storage.js";
import { MemoryDeckStorage, type DeckStorage } from "./engine/deck-storage.js";
import type { EngineHost } from "./engine/host.js";
import { IdbDeckStorage } from "./engine/idb-deck-storage.js";
import { SessionStore } from "./store/session-store.js";
import { defaultSettings, type Settings } from "./settings.js";
import { emptyLog, type LogState } from "./view/log-lines.js";
import type { MusicController } from "./audio/music-controller.js";

export interface AppSession {
  readonly host: EngineHost;
  readonly store: SessionStore;
  settings: Settings;
  /**
   * Background music controller, populated when the client game boots.
   */
  music?: MusicController;
  /**
   * The current game's log, for any scene that needs its history rather than
   * just the latest command's `lastEvents` — Pause's "Jump to a moment"
   * (`scenes/pause.ts`) is the first caller. `scenes/board.ts` is the sole
   * writer: it already folds every command onto its own `#log` field to
   * drive the on-table log panel, and mirrors that same fold here so a
   * second scene doesn't have to reach into the Board's own instance (an
   * overlay reads state, never another scene's internals) or re-run
   * `appendEvents` a second time over the same events. Reset to `emptyLog()`
   * whenever the Board's own `create()` starts a fresh game, for the same
   * reason its own `#log` resets there ("Run it back"/"Continue" reuse one
   * Phaser scene instance across games).
   */
  gameLog: LogState;
}

let session: AppSession | null = null;

export function appSession(): AppSession {
  if (!session) {
    const host = createEngineHost();
    session = { host, store: new SessionStore(host), settings: defaultSettings(), gameLog: emptyLog() };
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

/**
 * The campaign loop (`campaign/campaign-service.ts`) over its own `mc-campaigns` database — a third store, so a
 * campaign write can never break a game resume (docs/campaign-mode-design.md §10.1). Same IndexedDB-or-memory guard
 * as `deckStorage`. Built on first use, so
 * a player who never opens Campaign never opens the database.
 */
let campaigns: CampaignService | null = null;

/**
 * Definitions the shipped registry (`@mc/cards`' `campaignDefinitionOf`) doesn't know — a dev/test fixture's own
 * synthetic box (`campaign/dev-fixtures.ts`'s `HIDDEN_EVIDENCE_DEFINITION`), never a real one. Empty in a normal
 * session: nothing calls `registerDevCampaignDefinition` outside a dev jump or a test, and this map itself carries
 * no box data of its own — the fixture's `CampaignDefinition` lives in `campaign/dev-fixtures.ts`, dev/test code
 * only. `campaignService()`'s own `definitionOf` checks the real registry first, so a real box can never be
 * shadowed by a same-named dev entry.
 */
const devDefinitions = new Map<string, CampaignDefinition>();

/**
 * Registers a synthetic `CampaignDefinition` the shipped `@mc/cards` registry doesn't carry, so `campaignService()`
 * can load a dev/test fixture's own run through the same `definitionFor`/`compose` path a real box uses. Gated on
 * `import.meta.env.DEV` (a no-op call in a production build, same guard `main.ts`'s `__mcCampaign` console helper
 * already uses) rather than trusting a caller to only ever reach this from dev code.
 */
export function registerDevCampaignDefinition(definition: CampaignDefinition): void {
  if (!import.meta.env.DEV) return;
  devDefinitions.set(definition.campaignId as string, definition);
}

export function campaignService(): CampaignService {
  campaigns ??= new CampaignService({
    storage: typeof indexedDB !== "undefined" ? new IdbCampaignStorage() : new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
    definitionOf: (campaignId) => campaignDefinitionOf(campaignId) ?? devDefinitions.get(campaignId as string),
  });
  return campaigns;
}
