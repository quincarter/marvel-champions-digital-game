/**
 * A game being watched back (issue #693): the replay worker's whole job, kept here as plain code the tests call.
 *
 * It rebuilds a game from its log once, through `ReplayCursor` (the same baseline `resume` uses, a checkpoint every 20
 * commands so a seek replays at most 20), and answers "the table after `n` commands" as the `Snapshot` the board
 * already draws. Nothing here can reach a live game: it holds its own copy of the log and has no storage to write.
 *
 * A replay from another build is checked against the checksums its writer took (`replay-file.ts`), and is played only
 * as far as its commands still apply (`ReplayCursor`'s lenient build): `info` says where it first differs and where it
 * stops, for the screen to say so.
 */
import { applyCommand, type Command, type EngineDeps, type GameOutcome, type GameState } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { emptyRecord, recordEvents, type GameRecord } from "../engine/game-record.js";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { inVillainPhase, sealedEventStates, stripSealedPool, type Snapshot } from "../engine/session-core.js";
import { sealForTable } from "../view/hidden-reverse.js";
import { ReplayCursor, type ReplayFailure, type ReplayMoment } from "../view/replay-cursor.js";
import {
  ChecksumCheck,
  ChecksumWriter,
  REPLAY_FORMAT,
  REPLAY_VERSION,
  writtenElsewhere,
  type ReplayFile,
  type ReplayWriter,
} from "./replay-file.js";

/** A game's log as a save holds it: what a replay is built from when it isn't a file yet. */
export interface ReplayLog {
  readonly config: SessionConfig;
  readonly initialState: StateWithoutPool;
  readonly commands: readonly Command[];
  readonly createdAt: number;
  readonly outcome: GameOutcome | null;
  readonly round: number;
}

export type ReplaySource =
  | { readonly kind: "file"; readonly file: ReplayFile }
  | { readonly kind: "log"; readonly log: ReplayLog };

/** What the replay screen shows about the game as a whole. */
export interface ReplayInfo {
  /** The positions that can be shown are 0..length: every command that applied on this build. */
  readonly length: number;
  /** Commands in the log, which is more than `length` when this build stopped short (`failure`). */
  readonly total: number;
  readonly moments: readonly ReplayMoment[];
  /** The first position whose state is not the one the replay's writer had, or null. */
  readonly divergedAt: number | null;
  readonly failure: ReplayFailure | null;
  /** The replay was written by another release, card pool or commit than this one. */
  readonly otherBuild: boolean;
  readonly writer: ReplayWriter;
  readonly config: SessionConfig;
  readonly createdAt: number;
  readonly outcome: GameOutcome | null;
  readonly round: number;
}

export class ReplaySession {
  readonly #cursor: ReplayCursor;
  readonly #source: ReplayLog;
  readonly #writer: ReplayWriter;
  readonly #checksums: readonly string[];
  readonly #records: readonly GameRecord[];
  readonly #deps: EngineDeps;
  readonly info: ReplayInfo;

  private constructor(
    cursor: ReplayCursor,
    source: ReplayLog,
    writer: ReplayWriter,
    checksums: readonly string[],
    records: readonly GameRecord[],
    info: ReplayInfo,
    deps: EngineDeps,
  ) {
    this.#cursor = cursor;
    this.#source = source;
    this.#writer = writer;
    this.#checksums = checksums;
    this.#records = records;
    this.info = info;
    this.#deps = deps;
  }

  /**
   * Rebuilds the game. Throws (a `SetupError`) only when its scenario can no longer be set up at all; a log whose
   * commands stop applying part way is opened up to there.
   */
  static open(source: ReplaySource, here: ReplayWriter, deps: EngineDeps = POOL_DEPS): ReplaySession {
    const log: ReplayLog = source.kind === "file" ? source.file : source.log;
    const writer = source.kind === "file" ? source.file.writer : here;
    const check = source.kind === "file" ? new ChecksumCheck(source.file.checksums) : null;
    const written = source.kind === "log" ? new ChecksumWriter() : null;
    const records: GameRecord[] = [];
    let record = emptyRecord();
    // Every position's state, in order, from the cursor's one forward pass: the records are folded from them after.
    const pending: { index: number; state: GameState }[] = [];
    const cursor = ReplayCursor.fromStoredGame(log.config, log.initialState, log.commands, deps, {
      lenient: true,
      observe: (index, state) => {
        check?.observe(index, state);
        written?.observe(index, state);
        pending.push({ index, state });
      },
    });
    for (const { index, state } of pending) {
      const events = index === 0 ? cursor.historyTo(0) : cursor.eventsOf(index - 1);
      record = recordEvents(record, events, state, deps);
      records.push(record);
    }
    const info: ReplayInfo = {
      length: cursor.length,
      total: log.commands.length,
      moments: cursor.moments,
      divergedAt: check?.divergedAt ?? null,
      failure: cursor.failure,
      otherBuild: writtenElsewhere(writer, here),
      writer,
      config: log.config,
      createdAt: log.createdAt,
      outcome: log.outcome,
      round: log.round,
    };
    const checksums = source.kind === "file" ? source.file.checksums : (written?.values ?? []);
    return new ReplaySession(cursor, log, writer, checksums, records, info, deps);
  }

  /**
   * The table after `n` commands (clamped to `0..length`), as the board draws it: sealed, without the card pool.
   *
   * `played` is for stepping forward one command: the snapshot then carries that command's events and its villain-phase
   * states, so the board animates the step as it did in the game. Otherwise (a seek) it carries the whole history up to
   * there instead, which the board rebuilds its log from, and no events to animate.
   */
  snapshotAt(n: number, played: boolean): Snapshot {
    const position = this.#cursor.at(n);
    const index = position.commandIndex;
    const sealed = stripSealedPool(sealForTable(position.state));
    const base = {
      version: index,
      state: sealed,
      legal: null,
      record: this.#records[index] ?? emptyRecord(),
      config: this.info.config,
      saveError: null,
      gameId: null,
    };
    if (played && index > 0) {
      const before = this.#cursor.at(index - 1).state;
      const command = this.#source.commands[index - 1];
      const result = command ? applyCommand(before, command, this.#deps, { recordStates: inVillainPhase }) : null;
      const states = result?.ok ? sealedEventStates(result.states ?? []) : [];
      return { ...base, events: position.events, ...(states.length > 0 ? { states } : {}) };
    }
    return { ...base, events: [], history: this.#cursor.historyTo(index) };
  }

  /** The printed cards the game was rebuilt with: what the table re-attaches to every snapshot. */
  get cardPool(): GameState["cardPool"] {
    return this.#cursor.at(0).state.cardPool;
  }

  /** The replay as a file: the one it was opened from, or a new one stamped by this build. */
  toFile(exportedAt: number): ReplayFile {
    const log = this.#source;
    return {
      format: REPLAY_FORMAT,
      version: REPLAY_VERSION,
      exportedAt,
      writer: this.#writer,
      config: log.config,
      createdAt: log.createdAt,
      outcome: log.outcome,
      round: log.round,
      initialState: log.initialState,
      commands: log.commands,
      checksums: this.#checksums,
    };
  }
}
