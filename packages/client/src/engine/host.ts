/**
 * The client's only door to the rules.
 *
 * PLAN.md Phase 4: "Phaser is a view, never an authority." Scenes, view models
 * and the session store talk to an `EngineHost` and nothing else — they never
 * import `applyCommand` and never decide legality. Two implementations exist:
 * `WorkerEngineHost` (the game; keeps the engine off the main thread because
 * `legalActions` peaks at ~194 ms in a 4-player Ultron game) and
 * `LocalEngineHost` (Vitest and debugging, same interface, in-thread).
 *
 * Phase 5 note: this async shape is what host- or server-authoritative
 * multiplayer needs, so a network host can replace the worker without the
 * client changing.
 */

import type { CorePlayer } from "@mc/cards";
import type { AnyCard, PlayModes } from "@mc/content";
import type { Command, EngineError, GameEvent, GameState, LegalActions, PlayerId } from "@mc/engine";
import type { GameRecord } from "./game-record.js";
import type { SaveMeta } from "./game-storage.js";

/**
 * What the session flow collects across the Scenario → Seats → Deck screens.
 *
 * `difficulty` gained `"extreme"` for Breakout's own multi-villain challenge
 * (docs/phase7-wave1.md §2.3, §4.6: version A in play with version B
 * underneath). `villainVersions` overrides `difficulty`'s uniform default
 * per villain, in the scenario's printed order — Breakout only; every other
 * scenario has one villain and reads `difficulty` alone.
 *
 * This is also the save shape (`game-storage.ts`'s `SaveMeta.config`), so every
 * field here has to be additive: `modes` is optional and a save written before
 * it existed carries only `difficulty`, which still resolves to exactly the same
 * mode set.
 */
export interface SessionConfig {
  readonly scenarioId: string;
  readonly difficulty: "standard" | "expert" | "extreme";
  /**
   * The full RRG 1.8 mode set (`@mc/content`'s `schema/modes.ts`, pp. 28–29), of which `difficulty` is the
   * expert half. Campaign is an orthogonal axis here and nothing reads it yet.
   *
   * **Old saves.** Absent on every save written before this field existed, and absent is not "standard": it
   * means "this config only ever said `difficulty`", so `session-core.ts`'s `scenarioFor` passes `difficulty`
   * through alone and the scenario builder derives the modes from it (`resolveModes`). An old save therefore
   * replays byte-for-byte, and `"extreme"` — a per-villain version choice, not a mode — keeps working because
   * it never becomes a `PlayModes` at all.
   */
  readonly modes?: PlayModes;
  /** Defaults to the scenario's recommended modular set(s) when omitted. */
  readonly modularSetIds?: readonly string[];
  readonly players: readonly CorePlayer[];
  readonly seed: number;
  readonly firstPlayerIndex?: number;
  /** Multi-villain scenarios only: each villain's own version, overriding `difficulty` for that one villain. */
  readonly villainVersions?: readonly ("A" | "B" | "extreme")[];
}

/**
 * Printed card data, sent across the worker boundary once at startup and
 * re-attached to every state the host publishes. Measured at 205 KB with the
 * pool and 68 KB without it, so keeping it out of each update is most of the
 * copying cost.
 */
export type CardPool = Readonly<Record<string, AnyCard>>;

/** The state as it crosses the worker boundary: everything but the card pool. */
export type StateWithoutPool = Omit<GameState, "cardPool">;

/** What a player may do, and who they are. Computed ahead of time by the host. */
export interface LegalActionsFor {
  readonly playerId: PlayerId;
  readonly actions: LegalActions;
}

/**
 * One published state change. `version` is the command count: the store drops
 * any update or query result whose version is older than what it already holds,
 * which is how an out-of-order worker reply can never show stale state.
 */
export interface EngineUpdate {
  readonly version: number;
  /** Full state, card pool re-attached, so every `@mc/engine` query helper works. */
  readonly state: GameState;
  /** The events of the command that produced this state; empty for a resumed game's first update. */
  readonly events: readonly GameEvent[];
  /**
   * Legal actions for the player who must act — the active player during a
   * turn, or the player a pending choice is addressed to. Null when nobody
   * needs input (the game is over, or the engine is mid-phase with no choice).
   */
  readonly legal: LegalActionsFor | null;
  /** The game so far, for the game-over screen. Complete even for a resumed game. */
  readonly record: GameRecord;
  /** Set once saving has failed: the game plays on but may not survive a refresh. */
  readonly saveError: string | null;
  /** The setup this game came from, for a rematch. */
  readonly config: SessionConfig | null;
}

export type DispatchResult =
  | { readonly ok: true; readonly update: EngineUpdate }
  | { readonly ok: false; readonly error: EngineError };

/** A save: the replay baseline plus every command, exactly as `@mc/engine` defines it. */
export interface SavedGame {
  readonly initialState: GameState;
  readonly commands: readonly Command[];
}

export type UpdateListener = (update: EngineUpdate) => void;

export interface EngineHost {
  /** Creates the game and publishes its first update. */
  start(config: SessionConfig): Promise<EngineUpdate>;
  /** Picks a stored game back up by replaying its log, and publishes where it stands. */
  resume(gameId: string): Promise<EngineUpdate>;
  /** Applies a command. A rejected command leaves the game untouched. */
  dispatch(command: Command): Promise<DispatchResult>;
  /** An on-demand query, for a seat that isn't the one the host prefetched. */
  legalActions(playerId: PlayerId): Promise<LegalActions>;
  /** Every update, including the one `start` returns. Returns an unsubscribe. */
  subscribe(listener: UpdateListener): () => void;
  /** The replayable log, for export. */
  save(): Promise<SavedGame>;
  /** The stored game to offer as "Continue", or null. */
  latestSave(): Promise<SaveMeta | null>;
  /** Every saved game (W9's per-deck record and last played, `view/results-history.ts`). */
  listSaves(): Promise<readonly SaveMeta[]>;
  dispose(): void;
}
