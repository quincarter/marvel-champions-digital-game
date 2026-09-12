/**
 * Where games are kept between visits.
 *
 * What is stored is the game's **log**, not its state: the setup config, the
 * state right after setup (the replay baseline, without its card pool, which
 * reloads from the bundle), and every command in order. PLAN.md Phase 1 made
 * `applyCommand` pure and `replay()` deterministic precisely so that a log is a
 * complete description of a game — so resuming is "replay the log", and every
 * summary the game-over screen shows is derived from it rather than saved
 * alongside it where the two could disagree.
 *
 * Commands are appended one at a time, as each lands, with their sequence
 * number checked on the way in. A missed or reordered write is an error at the
 * moment it happens rather than a replay that silently diverges later.
 *
 * Two implementations share one contract test: `MemoryGameStorage` here, for
 * Vitest and the in-thread host, and `IdbGameStorage` for the browser.
 */

import type { Command, GameOutcome } from "@mc/engine";
import type { SessionConfig, StateWithoutPool } from "./host.js";

/** Bumped when the stored shape changes, so an old save is recognised instead of misread. */
export const SAVE_SCHEMA = 1;

/**
 * `incompatible`: the log no longer replays against this build's engine or
 * content — a card changed under it. Kept, not deleted, so the log can still be
 * exported; never offered as "Continue".
 */
export type SaveStatus = "active" | "won" | "lost" | "abandoned" | "incompatible";

export interface SaveMeta {
  readonly id: string;
  readonly schema: number;
  readonly config: SessionConfig;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly status: SaveStatus;
  readonly round: number;
  readonly commandCount: number;
  readonly outcome: GameOutcome | null;
}

/** What a command's arrival changes about a game's summary row. */
export type SaveProgress = Pick<SaveMeta, "round" | "commandCount" | "updatedAt" | "status" | "outcome">;

export interface StoredGame {
  readonly meta: SaveMeta;
  readonly initialState: StateWithoutPool;
  readonly commands: readonly Command[];
}

export interface GameStorage {
  /** Records a new game, retiring any game still marked active: one game in progress at a time. */
  create(meta: SaveMeta, initialState: StateWithoutPool): Promise<void>;
  /**
   * Appends command number `seq` (0-based) and updates the summary row, as one
   * atomic write. Rejects when `seq` isn't the next command, so a lost or
   * reordered write can never produce a log that replays differently.
   */
  append(gameId: string, seq: number, command: Command, progress: SaveProgress): Promise<void>;
  load(gameId: string): Promise<StoredGame | null>;
  /** The most recently played game still in progress — the one to offer as "Continue". */
  latestActive(): Promise<SaveMeta | null>;
  /** Every recorded game, most recently played first. */
  list(): Promise<readonly SaveMeta[]>;
  setStatus(gameId: string, status: SaveStatus): Promise<void>;
}

/** The newest active game in a list, or null. Shared so both storages answer the same way. */
export function newestActive(metas: readonly SaveMeta[]): SaveMeta | null {
  return metas.filter((meta) => meta.status === "active").sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

/**
 * The in-memory storage. Values are copied in and out with `structuredClone`,
 * exactly as IndexedDB copies them, so a test using this can't pass by accident
 * on shared references that the real storage would never have.
 */
export class MemoryGameStorage implements GameStorage {
  readonly #games = new Map<string, SaveMeta>();
  readonly #baselines = new Map<string, StateWithoutPool>();
  readonly #commands = new Map<string, Command[]>();

  async create(meta: SaveMeta, initialState: StateWithoutPool): Promise<void> {
    for (const [id, existing] of this.#games) {
      if (existing.status === "active") this.#games.set(id, { ...existing, status: "abandoned" });
    }
    this.#games.set(meta.id, structuredClone(meta));
    this.#baselines.set(meta.id, structuredClone(initialState));
    this.#commands.set(meta.id, []);
  }

  async append(gameId: string, seq: number, command: Command, progress: SaveProgress): Promise<void> {
    const meta = this.#games.get(gameId);
    const commands = this.#commands.get(gameId);
    if (!meta || !commands) throw new Error(`no saved game ${gameId}`);
    if (seq !== commands.length) throw new Error(`save out of order: expected command ${commands.length}, got ${seq}`);
    commands.push(structuredClone(command));
    this.#games.set(gameId, { ...meta, ...structuredClone(progress) });
  }

  async load(gameId: string): Promise<StoredGame | null> {
    const meta = this.#games.get(gameId);
    const initialState = this.#baselines.get(gameId);
    const commands = this.#commands.get(gameId);
    if (!meta || !initialState || !commands) return null;
    return structuredClone({ meta, initialState, commands });
  }

  async latestActive(): Promise<SaveMeta | null> {
    const found = newestActive([...this.#games.values()]);
    return found ? structuredClone(found) : null;
  }

  async list(): Promise<readonly SaveMeta[]> {
    return structuredClone([...this.#games.values()].sort((a, b) => b.updatedAt - a.updatedAt));
  }

  async setStatus(gameId: string, status: SaveStatus): Promise<void> {
    const meta = this.#games.get(gameId);
    if (meta) this.#games.set(gameId, { ...meta, status });
  }
}
