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
import { withoutDeckNames } from "../engine/shared-config.js";
import { applyCommand, type Command, type EngineDeps, type GameOutcome, type GameState } from "@mc/engine";
import { poolViewOfPacks } from "../content/pool.js";
import { emptyRecord, recordEvents, type GameRecord } from "../engine/game-record.js";
import type { SessionConfig, StateWithoutPool } from "../engine/host.js";
import { inVillainPhase, sealedEventStates, stripSealedPool, type Snapshot } from "../engine/session-core.js";
import { sealForTable } from "../view/hidden-reverse.js";
import { gameLabelOf } from "../view/continue-label.js";
import { difficultyLabelOf } from "../view/difficulty-label.js";
import { GAME_LABEL_NAMES } from "../view/game-label-names.js";
import { gameOverModel } from "../view/game-over-model.js";
import { fullLogLines, logText } from "../view/log-export.js";
import { ReplayCursor, type ReplayFailure, type ReplayMoment } from "../view/replay-cursor.js";
import {
  ChecksumCheck,
  ChecksumWriter,
  LiveChecksumCheck,
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
  /**
   * The build that last wrote the saved game, when its save says (`SaveMeta.lastPlayedOn`): a game played on another
   * version can replay differently here, which the screen says. Its checksums are still this build's own.
   */
  readonly playedOn?: ReplayWriter;
  /** The saved game was adjusted (`SaveMeta.adjusted`, issue #791). Absent otherwise. */
  readonly adjusted?: true;
}

export type ReplaySource =
  | { readonly kind: "file"; readonly file: ReplayFile }
  | { readonly kind: "log"; readonly log: ReplayLog }
  /** A game still being played, followed live (issue #876): the host's checksums are keyed by command count. */
  | { readonly kind: "live"; readonly log: ReplayLog; readonly checksums: Readonly<Record<string, string>> };

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
  /**
   * The game was adjusted (issue #791): its save or file says so, or a command in it is a Manual adjust. An Undo past a
   * reveal leaves no command behind, so a file from before the mark existed can't show that one.
   */
  readonly adjusted: boolean;
}

/** A setup without its packs' data, which a replay file never carries (`ReplayFile.config`). */
export function withoutPacks(config: SessionConfig): SessionConfig {
  // `watchable`, `room`, `roomPlayMode` and `roomUndo` are the host's own settings for the game being streamed, not part of the game: never written to a file.
  if (
    config.packs === undefined &&
    config.watchable === undefined &&
    config.room === undefined &&
    config.roomPlayMode === undefined &&
    config.roomUndo === undefined &&
    config.roomCheats === undefined &&
    config.roomTeams === undefined &&
    config.localSeats === undefined
  ) {
    return config;
  }
  const {
    packs: _packs,
    watchable: _watchable,
    room: _room,
    roomPlayMode: _roomPlayMode,
    roomUndo: _roomUndo,
    roomCheats: _roomCheats,
    roomTeams: _roomTeams,
    localSeats: _localSeats,
    ...rest
  } = config;
  return rest;
}

/** How many commands apart a replay keeps the game's record (what Game over reports) for seeking. */
export const RECORD_EVERY = 20;

/** What a live replay keeps beside the cursor (issue #876). */
interface LiveTracking {
  readonly check: LiveChecksumCheck;
  readonly written: ChecksumWriter;
  record: GameRecord;
  /** The commands that applied: the log's own copy, which `toFile` and the snapshots read. */
  readonly commands: Command[];
  round: number;
}

export class ReplaySession {
  readonly #cursor: ReplayCursor;
  readonly #source: ReplayLog;
  readonly #writer: ReplayWriter;
  readonly #checksums: { readonly regular: readonly string[]; readonly final: string | undefined };
  readonly #records: Map<number, GameRecord>;
  readonly #deps: EngineDeps;
  #info: ReplayInfo;
  /** Set for a live source: what appends and rewinds check and write into (issue #876). */
  readonly #live: LiveTracking | null;

  private constructor(
    cursor: ReplayCursor,
    source: ReplayLog,
    writer: ReplayWriter,
    checksums: { readonly regular: readonly string[]; readonly final: string | undefined },
    records: Map<number, GameRecord>,
    info: ReplayInfo,
    deps: EngineDeps,
    live: LiveTracking | null,
  ) {
    this.#cursor = cursor;
    this.#source = source;
    this.#writer = writer;
    this.#checksums = checksums;
    this.#records = records;
    this.#info = info;
    this.#deps = deps;
    this.#live = live;
  }

  get info(): ReplayInfo {
    return this.#info;
  }

  /**
   * Rebuilds the game. Throws (a `SetupError`) only when its scenario can no longer be set up at all; a log whose
   * commands stop applying part way is opened up to there.
   */
  static open(source: ReplaySource, here: ReplayWriter, given?: EngineDeps): ReplaySession {
    const log: ReplayLog = source.kind === "file" ? source.file : source.log;
    // A game with custom packs plays with their cards and scripts, which its config carries (`SessionConfig.packs`).
    const deps = given ?? poolViewOfPacks(log.config.packs).deps;
    const writer =
      source.kind === "file" ? source.file.writer : source.kind === "live" ? (source.log.playedOn ?? here) : here;
    const finalChecksum = source.kind === "file" ? source.file.finalChecksum : undefined;
    const liveCheck = source.kind === "live" ? new LiveChecksumCheck() : null;
    if (source.kind === "live") liveCheck?.add(source.checksums);
    const check =
      source.kind === "file"
        ? new ChecksumCheck(
            source.file.checksums,
            finalChecksum === undefined ? undefined : { at: log.commands.length, checksum: finalChecksum },
          )
        : null;
    const written = source.kind !== "file" ? new ChecksumWriter() : null;
    // The record folded as the cursor's one forward pass goes, kept only every RECORD_EVERY positions and at the end: a
    // seek folds the few commands after the nearest one (`#recordAt`), so a long game holds a bounded number of records.
    const records = new Map<number, GameRecord>();
    let record = emptyRecord();
    let last = 0;
    const cursor = ReplayCursor.fromStoredGame(log.config, log.initialState, log.commands, deps, {
      lenient: true,
      observe: (_index, state, events) => {
        check?.observe(_index, state);
        liveCheck?.observe(_index, state);
        written?.observe(_index, state);
        record = recordEvents(record, events, state, deps);
        if (_index % RECORD_EVERY === 0) records.set(_index, record);
        last = _index;
      },
    });
    records.set(last, record);
    const info: ReplayInfo = {
      length: cursor.length,
      total: log.commands.length,
      moments: cursor.moments,
      divergedAt: check?.divergedAt ?? liveCheck?.divergedAt ?? null,
      failure: cursor.failure,
      otherBuild: writtenElsewhere(source.kind === "file" ? writer : (source.log.playedOn ?? here), here),
      writer,
      config: log.config,
      createdAt: log.createdAt,
      outcome: log.outcome,
      round: log.round,
      adjusted: log.adjusted === true || log.commands.some((command) => command.type === "adjust"),
    };
    const checksums = source.kind === "file" ? source.file.checksums : (written?.values ?? []);
    const final = source.kind === "file" ? finalChecksum : written?.final;
    // A live log is the session's own copy: appends push onto it, and a lenient build may have cut it short.
    const tracking: LiveTracking | null =
      liveCheck && written
        ? { check: liveCheck, written, record, commands: log.commands.slice(0, cursor.length), round: info.round }
        : null;
    const own: ReplayLog = tracking ? { ...log, commands: tracking.commands } : log;
    return new ReplaySession(cursor, own, writer, { regular: checksums, final }, records, info, deps, tracking);
  }

  /**
   * Live watching (issue #876): the host's next commands, with the checksums it took. Applied on the end state, folded
   * into the records and checked. Answers how many applied (fewer than given when one no longer applies here).
   */
  liveAppend(commands: readonly Command[], checksums?: Readonly<Record<string, string>>): number {
    const live = this.#requireLive();
    live.check.add(checksums);
    const total = this.#info.total + commands.length;
    const applied = this.#cursor.append(commands, (index, state, events) => {
      live.check.observe(index, state);
      live.written.observe(index, state);
      live.record = recordEvents(live.record, events, state, this.#deps);
      // Only every RECORD_EVERY records and the newest are kept.
      if ((index - 1) % RECORD_EVERY !== 0) this.#records.delete(index - 1);
      this.#records.set(index, live.record);
      live.round = state.round;
    });
    const taken = commands.slice(0, applied);
    live.commands.push(...taken);
    // Only what arrived is scanned, never the whole log.
    if (taken.some((command) => command.type === "adjust")) this.#info = { ...this.#info, adjusted: true };
    this.#refresh(total);
    return applied;
  }

  /** The host cut its log to the first `to` commands (an Undo or Back out). */
  liveRewind(to: number): void {
    const live = this.#requireLive();
    const target = Math.max(0, Math.min(Math.floor(to), this.#cursor.length));
    this.#cursor.truncate(target);
    live.commands.length = target;
    live.check.truncateTo(target);
    for (const key of [...this.#records.keys()]) if (key > target) this.#records.delete(key);
    live.record = this.#recordAt(target);
    this.#records.set(target, live.record);
    const { state } = this.#cursor.at(target);
    live.written.truncateTo(target, state);
    live.round = state.round;
    this.#info = { ...this.#info, outcome: null };
    this.#refresh(target);
  }

  /** The game ended: from here the replay is an ordinary one. */
  liveEnd(outcome: GameOutcome | null): void {
    this.#requireLive();
    this.#info = { ...this.#info, outcome };
  }

  #requireLive(): LiveTracking {
    if (!this.#live) throw new Error("this replay is not a live game");
    return this.#live;
  }

  /** Rebuilds `info`'s moving parts after the log changed. `total`: commands the host has, which may exceed what applied. */
  #refresh(total: number): void {
    const live = this.#live;
    this.#info = {
      ...this.#info,
      length: this.#cursor.length,
      total: Math.max(total, this.#cursor.length),
      moments: this.#cursor.moments,
      divergedAt: live?.check.divergedAt ?? this.#info.divergedAt,
      failure: this.#cursor.failure,
      round: live?.round ?? this.#info.round,
    };
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
      record: this.#recordAt(index),
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

  /** The game's whole log as text (`view/log-export.ts`), as far as it replays here. */
  logText(): string {
    const { state } = this.#cursor.at(this.info.length);
    const config = this.info.config;
    const record = this.#recordAt(this.info.length);
    return logText(
      {
        game: gameLabelOf(config, GAME_LABEL_NAMES),
        difficulty: difficultyLabelOf(config),
        result: state.outcome ? gameOverModel(state, record, config, this.#deps).headline : null,
        playedAt: this.info.createdAt,
        adjusted: this.info.adjusted,
      },
      fullLogLines(this.#cursor.historyTo(this.info.length), state, this.#deps),
    );
  }

  /** The record after `n` commands: the nearest kept one at or before it, with the commands between folded on. */
  #recordAt(n: number): GameRecord {
    const kept = this.#records.get(n);
    if (kept) return kept;
    const from = Math.floor(n / RECORD_EVERY) * RECORD_EVERY;
    let record = this.#records.get(from) ?? emptyRecord();
    for (let i = from + 1; i <= n; i++) {
      record = recordEvents(record, this.#cursor.eventsOf(i - 1), this.#cursor.at(i).state, this.#deps);
    }
    return record;
  }

  /** The number of records kept, for the tests: bounded by the game's length over `RECORD_EVERY`. */
  get keptRecords(): number {
    return this.#records.size;
  }

  /** The printed cards the game was rebuilt with: what the table re-attaches to every snapshot. */
  get cardPool(): GameState["cardPool"] {
    return this.#cursor.at(0).state.cardPool;
  }

  /** The replay as a file: the one it was opened from, or a new one stamped by this build. */
  toFile(exportedAt: number): ReplayFile {
    const log = this.#source;
    const final = this.#live ? this.#live.written.final : this.#checksums.final;
    return {
      format: REPLAY_FORMAT,
      version: REPLAY_VERSION,
      exportedAt,
      writer: this.#writer,
      config: withoutDeckNames(withoutPacks(log.config)),
      ...(log.config.packs?.length ? { packs: log.config.packs.map(({ id, version }) => ({ id, version })) } : {}),
      createdAt: log.createdAt,
      outcome: this.info.outcome,
      round: this.info.round,
      ...(this.info.adjusted ? { adjusted: true as const } : {}),
      initialState: log.initialState,
      commands: log.commands,
      checksums: this.#live ? this.#live.written.values : this.#checksums.regular,
      ...(final === undefined ? {} : { finalChecksum: final }),
    };
  }
}
