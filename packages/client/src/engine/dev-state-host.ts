/**
 * A dev-only `EngineHost` that plays from a `GameState` someone else built, in the page's own thread.
 *
 * The app's host builds every game from a `SessionConfig`, and the campaign is not registered in the client yet, so
 * there is no menu path to a game with a mission area (docs/phase7-wave8.md). A dev jump (`scenes/boot.ts`,
 * `?screen=board&fixture=mission`) builds the state with the cards package's own test builder and hands it here. It is
 * reached only through a dynamic import behind `import.meta.env.DEV`, so a production build never pulls it in. It keeps
 * no storage: nothing here saves, resumes or rewinds.
 */

import {
  legalActions as queryLegalActions,
  sessionApply,
  startSession,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameSession,
  type GameState,
  type LegalActions,
  type PlayerId,
} from "@mc/engine";
import { actingPlayer } from "./acting-player.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import type { SaveMeta } from "./game-storage.js";
import type { DispatchResult, EngineHost, EngineUpdate, SavedGame, SessionConfig, UpdateListener } from "./host.js";

export class DevStateHost implements EngineHost {
  readonly #initial: GameState;
  readonly #deps: EngineDeps;
  readonly #listeners = new Set<UpdateListener>();
  #session: GameSession | null = null;
  #version = 0;
  #record: GameRecord = emptyRecord();

  constructor(initial: GameState, deps: EngineDeps) {
    this.#initial = initial;
    this.#deps = deps;
  }

  /** Starts from the given state; the config only labels the update (a rematch is not offered for a dev state). */
  async start(config: SessionConfig): Promise<EngineUpdate> {
    this.#session = startSession(this.#initial);
    this.#version = 0;
    this.#record = recordEvents(emptyRecord(), [], this.#initial);
    return this.#publish([], config);
  }

  async resume(): Promise<EngineUpdate> {
    throw new Error("a dev state has nothing to resume");
  }

  async dispatch(command: Command): Promise<DispatchResult> {
    const session = this.#require();
    const result = sessionApply(session, command, this.#deps);
    if (!result.ok) return { ok: false, error: result.error };
    this.#session = result.session;
    this.#version += 1;
    this.#record = recordEvents(this.#record, result.events, result.session.state);
    return { ok: true, update: this.#publish(result.events, null) };
  }

  async rewindTo(): Promise<EngineUpdate> {
    throw new Error("a dev state cannot be rewound");
  }

  async legalActions(playerId: PlayerId): Promise<LegalActions> {
    return queryLegalActions(this.#require().state, playerId, this.#deps);
  }

  subscribe(listener: UpdateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async save(): Promise<SavedGame> {
    const { log } = this.#require();
    return { initialState: log.initialState, commands: log.commands };
  }

  async latestSave(): Promise<SaveMeta | null> {
    return null;
  }

  async listSaves(): Promise<readonly SaveMeta[]> {
    return [];
  }

  dispose(): void {
    this.#listeners.clear();
  }

  #publish(events: readonly GameEvent[], config: SessionConfig | null): EngineUpdate {
    const { state } = this.#require();
    const toAct = actingPlayer(state);
    const update: EngineUpdate = {
      version: this.#version,
      state,
      events,
      legal: toAct ? { playerId: toAct, actions: queryLegalActions(state, toAct, this.#deps) } : null,
      record: this.#record,
      saveError: null,
      config,
    };
    for (const listener of [...this.#listeners]) listener(update);
    return update;
  }

  #require(): GameSession {
    if (!this.#session) throw new Error("the dev state has not been started");
    return this.#session;
  }
}
