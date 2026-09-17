/**
 * A read-only cursor over a saved game's log: the `GameState` (and the
 * events that produced it) after any command count 0..length, without ever
 * touching the live session.
 *
 * S7 (docs/phase4-screen-gaps.md §2, "Log jump" — the shared prerequisite for
 * W4's "Jump to a moment" and W8's "Watch the replay"). Built on the exact
 * scenario-construction path `EngineSessionCore#resume` uses
 * (`../engine/session-core.js`'s `rebuildBaseline`), so a replayed state is
 * exactly what resuming that save would produce — this is not a second way
 * to build a game, and it never calls into `EngineSessionCore`, the session
 * store, or any live `EngineHost`.
 *
 * **Never touches the live session.** A cursor is built from a defensive
 * `structuredClone` of whatever baseline/commands it's handed and holds no
 * reference back into the caller's objects, so nothing it does — construction,
 * stepping, jumping — can reach the game actually being played
 * (`replay-cursor.test.ts`'s "leaves the live session untouched" proves this
 * with the live session's own state/log, before and after).
 *
 * **Stepping-back cost.** Moments (below) already require one full forward
 * pass over the log to find every round/phase boundary, so this class does
 * that pass once, at construction, and keeps a state checkpoint every
 * `CHECKPOINT_INTERVAL` commands along the way — free, since it was already
 * computing every intermediate state to look for boundary events. A later
 * jump to any index then replays at most `CHECKPOINT_INTERVAL` commands
 * forward from the nearest checkpoint, rather than the whole log from 0, and
 * memoizes the result so revisiting the same index is free. This is the
 * "keep checkpoints" side of the choice the task called out, not "always
 * re-replay from 0": measured against this app's own longest recorded game
 * (the Core e2e suite's 4-player Ultron game, 214 commands — see
 * `packages/cards/src/e2e.test.ts`), a full 214-command forward replay took
 * low single-digit milliseconds in Vitest, so re-replaying from 0 on every
 * jump would already have been acceptable for a click-through jump list; the
 * checkpoint scheme exists for the case that matters more, a slider dragged
 * pixel-by-pixel across the whole log, where re-replaying from 0 per pixel
 * would turn into the O(N²) the task warned about. `CHECKPOINT_INTERVAL = 20`
 * bounds a *fresh* jump to at most 20 engine calls; `#resolve` also caches
 * every index it walks through on the way, not only its destination, so a
 * scrub that visits a whole stretch one command at a time (stepping back
 * through a phase, say) pays for that stretch once rather than once per step
 * — a full one-command-at-a-time walk of the entire log costs roughly
 * `length` engine calls in total, not `length * CHECKPOINT_INTERVAL`
 * (`replay-cursor.test.ts` measures this on a 150+ command log rather than
 * asserting it from the algorithm alone). Memory cost is bounded by however
 * many distinct indices a session actually visits, which for a UI a person is
 * looking at is always far below the log length.
 */

import {
  applyCommand,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
} from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { rebuildBaseline } from "../engine/session-core.js";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";

/** How many commands apart the eager checkpoints are kept. */
const CHECKPOINT_INTERVAL = 20;

/**
 * One row a "jump to a moment" list would show.
 *
 * A moment only exists where a command actually landed: a round or phase
 * boundary that a command passed through *and then left again*, all within
 * that one command (the engine can run a whole villain phase and roll into
 * the next round's player phase in one `endTurn`, when nothing pauses it —
 * `view/villain-walkthrough.ts` documents the same fact for its own event
 * walk), produces no moment, because there is no command index a jump could
 * land on to see it. Round boundaries are far less often lost this way than
 * phase boundaries, since a round change is visible in the final state even
 * when the phase it started in already yielded to another phase before the
 * command finished; a "Villain Phase" moment only shows up when something —
 * most often another seat's defend decision — pauses a command while still
 * inside that phase.
 */
export interface ReplayMoment {
  /** Jumping here shows the state right after this moment happened. */
  readonly commandIndex: number;
  readonly round: number;
  /** Wording reused from `view/log-lines.ts` where it has an exact match ("Round N begins"); the phase names are the RRG's own step-phase vocabulary (`@mc/engine`'s `GameStep`), not invented copy. */
  readonly label: string;
  readonly kind: "start" | "round" | "villainPhase" | "playerPhase";
}

/** One position the cursor can sit at. */
export interface ReplayPosition {
  readonly commandIndex: number;
  readonly length: number;
  readonly state: GameState;
  /** The events of the command that produced this position; empty at index 0. */
  readonly events: readonly GameEvent[];
}

interface Checkpoint {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export class ReplayCursor {
  readonly #commands: readonly Command[];
  readonly #deps: EngineDeps;
  readonly #checkpoints: Map<number, Checkpoint>;
  readonly #moments: readonly ReplayMoment[];
  #index = 0;
  /**
   * Test-only diagnostic: how many times this cursor has actually asked the
   * engine to apply a command, across its whole lifetime. Used only to prove
   * the checkpoint scheme bounds stepping cost — nothing in the class reads it.
   */
  applyCount = 0;

  private constructor(commands: readonly Command[], checkpoints: Map<number, Checkpoint>, moments: readonly ReplayMoment[], deps: EngineDeps) {
    this.#commands = commands;
    this.#checkpoints = checkpoints;
    this.#moments = moments;
    this.#deps = deps;
  }

  /**
   * Builds a cursor over a stored game: a `SessionConfig` plus the stored
   * baseline (without its card pool, per `game-storage.ts`) and its commands
   * — exactly `StoredGame`'s own shape, minus `meta`. Throws if the scenario
   * itself can no longer be set up (the same case `resume` throws for).
   */
  static fromStoredGame(
    config: SessionConfig,
    storedInitialState: StateWithoutPool,
    commands: readonly Command[],
    deps: EngineDeps = POOL_DEPS,
  ): ReplayCursor {
    const baseline = rebuildBaseline(config, storedInitialState);
    return ReplayCursor.#build(baseline.initialState, baseline.setupEvents, commands, deps);
  }

  /**
   * Builds a cursor directly over a log that already carries its own card
   * pool — a live session's own `GameLog`/`SavedGame` (`session.save()`).
   * No scenario rebuild is needed or attempted; the caller's `initialState`
   * is trusted as-is (still defensively cloned, so the cursor never aliases it).
   */
  static fromLog(initialState: GameState, commands: readonly Command[], deps: EngineDeps = POOL_DEPS): ReplayCursor {
    return ReplayCursor.#build(initialState, [], commands, deps);
  }

  static #build(initialState: GameState, setupEvents: readonly GameEvent[], commands: readonly Command[], deps: EngineDeps): ReplayCursor {
    // Defensive copies: a cursor never holds a reference into whatever object
    // the caller passed in, so nothing it later does can reach back into the
    // live session those objects might belong to.
    const clonedInitial = structuredClone(initialState) as GameState;
    const clonedCommands = structuredClone(commands) as Command[];
    const clonedSetupEvents = structuredClone(setupEvents) as GameEvent[];

    const checkpoints = new Map<number, Checkpoint>();
    checkpoints.set(0, { state: clonedInitial, events: clonedSetupEvents });

    const moments: ReplayMoment[] = [];
    let phase = clonedInitial.step.phase;
    let round = clonedInitial.round;
    moments.push({ commandIndex: 0, round, label: "Game start", kind: "start" });
    if (phase === "player") moments.push({ commandIndex: 0, round, label: "Player Phase", kind: "playerPhase" });
    if (phase === "villain") moments.push({ commandIndex: 0, round, label: "Villain Phase", kind: "villainPhase" });

    let state = clonedInitial;
    for (let i = 0; i < clonedCommands.length; i++) {
      const result = applyCommand(state, clonedCommands[i]!, deps);
      if (!result.ok) {
        throw new Error(`replay diverges at command ${i + 1} of ${clonedCommands.length}: ${result.error.message}`);
      }
      state = result.state;
      const index = i + 1;

      /**
       * Moments are keyed off the *resting* state after the whole command,
       * not off intermediate events within it — a single command can run an
       * entire villain phase and roll into the next round in one step
       * (`view/villain-walkthrough.ts`'s own comment on this), and a
       * command-granularity cursor can only ever jump to where a command
       * actually landed. So a round or phase boundary crossed and then left
       * again inside one command produces no moment (there is no index a
       * jump could land on to see it); only where the command actually ends
       * up does.
       */
      if (state.round !== round) {
        round = state.round;
        moments.push({ commandIndex: index, round, label: `Round ${round} begins`, kind: "round" });
      }
      if (state.step.phase !== phase) {
        phase = state.step.phase;
        if (phase === "villain") moments.push({ commandIndex: index, round, label: "Villain Phase", kind: "villainPhase" });
        else if (phase === "player") moments.push({ commandIndex: index, round, label: "Player Phase", kind: "playerPhase" });
      }

      if (index % CHECKPOINT_INTERVAL === 0 || index === clonedCommands.length) {
        checkpoints.set(index, { state, events: result.events });
      }
    }

    return new ReplayCursor(clonedCommands, checkpoints, moments, deps);
  }

  /** Total commands in the log. Valid indices are 0..length inclusive. */
  get length(): number {
    return this.#commands.length;
  }

  /** The index the cursor currently sits at. */
  get index(): number {
    return this.#index;
  }

  /** Every round/phase boundary the log passes through, in order, for a jump list. */
  get moments(): readonly ReplayMoment[] {
    return this.#moments;
  }

  /** The cursor's current position. Never mutates anything. */
  current(): ReplayPosition {
    return this.at(this.#index);
  }

  /**
   * The state (and producing events) after exactly `n` commands, without
   * moving the cursor. `n` is clamped to `[0, length]`.
   */
  at(n: number): ReplayPosition {
    const target = Math.max(0, Math.min(n, this.#commands.length));
    const checkpoint = this.#resolve(target);
    return { commandIndex: target, length: this.#commands.length, state: checkpoint.state, events: checkpoint.events };
  }

  /** Moves the cursor to `n` (clamped) and returns the resulting position. */
  jumpTo(n: number): ReplayPosition {
    const position = this.at(n);
    this.#index = position.commandIndex;
    return position;
  }

  stepForward(): ReplayPosition {
    return this.jumpTo(this.#index + 1);
  }

  stepBack(): ReplayPosition {
    return this.jumpTo(this.#index - 1);
  }

  toStart(): ReplayPosition {
    return this.jumpTo(0);
  }

  toEnd(): ReplayPosition {
    return this.jumpTo(this.#commands.length);
  }

  /** Finds or builds the checkpoint at exactly `n`, replaying at most `CHECKPOINT_INTERVAL` commands to get there. */
  #resolve(n: number): Checkpoint {
    const cached = this.#checkpoints.get(n);
    if (cached) return cached;

    let from = 0;
    for (const key of this.#checkpoints.keys()) {
      if (key <= n && key > from) from = key;
    }
    let { state } = this.#checkpoints.get(from)!;
    // Every index passed through on the way to `n` is cached too, not only
    // `n` itself — a later jump into this same stretch (the common case while
    // scrubbing one command at a time) then costs nothing rather than paying
    // to re-walk the stretch from its nearest checkpoint again.
    for (let i = from; i < n; i++) {
      const result = applyCommand(state, this.#commands[i]!, this.#deps);
      this.applyCount += 1;
      if (!result.ok) {
        throw new Error(`replay diverges at command ${i + 1} of ${this.#commands.length}: ${result.error.message}`);
      }
      state = result.state;
      this.#checkpoints.set(i + 1, { state, events: result.events });
    }
    return this.#checkpoints.get(n)!;
  }
}
