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

/**
 * Bumped when the stored shape changes, so an old save is recognised instead of misread.
 *
 * - 2 (2026-09-13): the engine state holds several villains and an encounter deck per villain
 *   (`villains`/`activeVillainId`, `encounterDecks`, `CardInstance.home`; docs/phase7-wave1.md §3.1–§3.2). Saves
 *   from 1 are retired, not migrated (user decision, PLAN.md Phase 7): marked `incompatible`, never offered as
 *   Continue.
 * - 3 (2026-09-19): separate game areas, scenario decks and set-aside scenario cards, and three-sided identities
 *   add required state (docs/phase7-wave2.md §3). Saves from 2 are retired the same way.
 * - 4 (2026-09-22): `SaveMeta.campaignId`/`campaignNodeId` (docs/campaign-mode-design.md §10.1), so the campaign
 *   browser can link a row to the game it played and the game-over screen knows to return to the campaign. Unlike
 *   2 and 3, this changes nothing about `StateWithoutPool` — it is metadata about which save a save *is*, not a
 *   new required piece of replayable state — so a save from schema 3 is not retired: `migrateSaveMeta` upgrades it
 *   on read, filling both fields `null` (an old save was never part of a campaign), and it resumes exactly as it
 *   always did. Anything older than 3 is still retired, as before.
 */
export const SAVE_SCHEMA = 4;

/** Whether this build can read a save: only the current schema. Anything older is retired, not migrated. */
export const isCurrentSchema = (meta: Pick<SaveMeta, "schema">): boolean => meta.schema === SAVE_SCHEMA;

/**
 * Upgrades a `SaveMeta` written under schema 3 to schema 4 by filling `campaignId`/`campaignNodeId` with `null` —
 * the purely-additive migration schema 4 needs (see `SAVE_SCHEMA`'s doc comment). Anything else — already current,
 * or older than 3 — passes through untouched; an older schema is still retired by `isCurrentSchema`, not migrated
 * here. Applied by both storages on every read path (`load`, `list`, `latestActive`), never on write, so what a
 * caller stored is still exactly what a caller stored.
 */
export function migrateSaveMeta(meta: SaveMeta): SaveMeta {
  if ((meta.schema as number) !== 3) return meta;
  return {
    ...meta,
    schema: SAVE_SCHEMA,
    campaignId: meta.campaignId ?? null,
    campaignNodeId: meta.campaignNodeId ?? null,
  };
}

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
  /**
   * Which campaign, and which of its nodes, this save was played as — null for a standalone game. Set once at
   * `create` from `config.campaign` and never changed after (a save belongs to the node it was launched for; a
   * retry composes a *new* save for the same node, docs/campaign-mode-design.md §7.3's "re-entry is re-running").
   */
  readonly campaignId: string | null;
  readonly campaignNodeId: string | null;
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
  /**
   * Drops every command from `commandCount` on, and updates the summary row — the write side of "Back out"
   * (`engine/session-core.ts`'s `rewindTo`). The baseline is untouched: a rewind only ever removes commands, never
   * changes what a game started as.
   */
  truncate(gameId: string, commandCount: number, progress: SaveProgress): Promise<void>;
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

  async truncate(gameId: string, commandCount: number, progress: SaveProgress): Promise<void> {
    const meta = this.#games.get(gameId);
    const commands = this.#commands.get(gameId);
    if (!meta || !commands) throw new Error(`no saved game ${gameId}`);
    commands.length = commandCount;
    this.#games.set(gameId, { ...meta, ...structuredClone(progress) });
  }

  async load(gameId: string): Promise<StoredGame | null> {
    const meta = this.#games.get(gameId);
    const initialState = this.#baselines.get(gameId);
    const commands = this.#commands.get(gameId);
    if (!meta || !initialState || !commands) return null;
    return structuredClone({ meta: migrateSaveMeta(meta), initialState, commands });
  }

  async latestActive(): Promise<SaveMeta | null> {
    const found = newestActive([...this.#games.values()].map(migrateSaveMeta));
    return found ? structuredClone(found) : null;
  }

  async list(): Promise<readonly SaveMeta[]> {
    return structuredClone([...this.#games.values()].map(migrateSaveMeta).sort((a, b) => b.updatedAt - a.updatedAt));
  }

  async setStatus(gameId: string, status: SaveStatus): Promise<void> {
    const meta = this.#games.get(gameId);
    if (meta) this.#games.set(gameId, { ...meta, status });
  }
}
