/**
 * A seated guest's engine session (issue #881, docs/live-game-rooms.md section 9): the room's game, rebuilt from the
 * host's log and kept in step with it, with the whole engine behind it, so the table is the live game and the engine
 * can say what this device's heroes may do. It runs in the seat worker (`workers/seat.worker.ts`), never on main.
 *
 * It is not the host: it never decides an outcome. A command is applied only because the room delivered it in the
 * host's log; what a guest wants to do goes out as a proposal (`seat-follower.ts`) and comes back, if accepted, as that
 * log's next command. Like a watcher's replay it checks the host's checksums, and says where it first differs.
 *
 * Unlike a watcher's replay (`replay-session.ts`), a seat answers the engine's questions: `legal` is filled when the
 * actions or the pending choice belong to one of the heroes this device holds, and `legalActions` / `judgePayment`
 * are answered from the full state, as the local engine worker does.
 */
import { applyCommand, legalActions as queryLegalActions, sessionApply, startSession } from "@mc/engine";
import type { Command, EngineDeps, GameEvent, GameState, LegalActions, PlayerId } from "@mc/engine";
import { poolViewOfPacks } from "../content/pool.js";
import { actingPlayer } from "../engine/acting-player.js";
import { emptyRecord, recordEvents, type GameRecord } from "../engine/game-record.js";
import type { CardPool, LegalActionsFor, StateWithoutPool } from "../engine/host.js";
import {
  inVillainPhase,
  rebuildBaseline,
  sealedEventStates,
  stripSealedPool,
  type Snapshot,
} from "../engine/session-core.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { REPLAY_FORMAT, REPLAY_VERSION, LiveChecksumCheck, replayChecksum } from "../replay/replay-file.js";
import { ReplayOpenError, trustedFile } from "../replay/replay-core.js";
import type { BackOutTrailEntry } from "../view/back-out.js";
import type { PaymentState } from "../view/payment-model.js";
import { judgePayment, type JudgedPayment } from "../view/payment-verdict.js";
import { sealForTable } from "../view/hidden-reverse.js";
import { parseLiveHeader } from "./watch-header.js";

/** The most commands a room's game may hold here: the replay cap, a long four-hero game is a few thousand. */
export const MAX_SEAT_COMMANDS = 20_000;

/** What the table's change was, so the main thread can tell its own move's echo from anyone else's. */
export type SeatChange =
  | { readonly type: "rewind" | "players" }
  /** The whole log as read (a first open, or a reconnect's reset), so waiting proposals can be matched against it. */
  | { readonly type: "open" | "reset"; readonly commands: readonly Command[] }
  /** `commands` are the log's commands from index `from`: a proposal made at `base` is accepted when `commands[base - from]` is it. */
  | { readonly type: "append"; readonly from: number; readonly commands: readonly Command[] };

/** An engine player id of a seat this device holds (`RoomSeat.player`, `playerIdOfSeat`). */
export type SeatPlayer = string;

export interface SeatOpenInput {
  /** The room's table header, opaque until read. */
  readonly header: unknown;
  readonly commands: readonly Command[];
  readonly checksums: Readonly<Record<string, string>>;
  /** The viewer's installed packs, which the game plays with when it names them. */
  readonly packs: readonly PackRuntime[];
}

/** A snapshot as the seat core makes it: the `Snapshot` the board reads, plus what changed. */
export type SeatSnapshot = Snapshot & { readonly change: SeatChange };

export class SeatCore {
  #deps: EngineDeps | null = null;
  #config: Snapshot["config"] = null;
  #initial: GameState | null = null;
  #state: GameState | null = null;
  #setupEvents: readonly GameEvent[] = [];
  #baseRecord: GameRecord = emptyRecord();
  #record: GameRecord = emptyRecord();
  /** The log, and what each command produced, in step with it. */
  #commands: Command[] = [];
  #events: (readonly GameEvent[])[] = [];
  #trail: BackOutTrailEntry[] = [];
  #check = new LiveChecksumCheck();
  #players: readonly SeatPlayer[] = [];

  /** The heroes this device holds. */
  hold(players: readonly SeatPlayer[]): void {
    this.#players = players;
  }

  /** The table again, at the same position, with `legal` for the heroes now held. */
  republish(): SeatSnapshot {
    return this.#snapshot([], { type: "players" });
  }

  /** Rebuilds the game from the room's log. Throws a `ReplayOpenError` when it cannot be read or set up here. */
  open(
    input: SeatOpenInput,
    type: "open" | "reset" = "open",
  ): { readonly cardPool: CardPool; readonly snapshot: SeatSnapshot } {
    const header = parseLiveHeader(input.header);
    if (!header) throw new ReplayOpenError("damaged");
    if (input.commands.length > MAX_SEAT_COMMANDS) throw new ReplayOpenError("damaged");
    // Vetted and set up afresh the way a replay is (`trustedFile`): nothing a header says beyond its setup is trusted.
    const file = trustedFile(
      {
        format: REPLAY_FORMAT,
        version: REPLAY_VERSION,
        exportedAt: 0,
        writer: header.writer,
        config: header.config,
        ...(header.packs ? { packs: header.packs } : {}),
        createdAt: header.createdAt,
        outcome: null,
        round: 0,
        initialState: header.initialState,
        commands: input.commands,
        checksums: [],
      },
      input.packs,
    );
    const config = file.config;
    const deps = poolViewOfPacks(config.packs).deps;
    let baseline;
    try {
      baseline = rebuildBaseline(config, file.initialState);
    } catch (cause) {
      throw new ReplayOpenError("setup", cause instanceof Error ? cause.message : String(cause));
    }
    this.#deps = deps;
    this.#config = config;
    this.#initial = baseline.initialState;
    this.#setupEvents = baseline.setupEvents;
    this.#baseRecord = recordEvents(emptyRecord(), baseline.setupEvents, baseline.initialState, deps);
    this.#check = new LiveChecksumCheck();
    this.#check.add(input.checksums);
    this.#replayFrom(input.commands);
    return {
      cardPool: baseline.initialState.cardPool,
      snapshot: this.#snapshot([], { type, commands: input.commands }, true),
    };
  }

  /** The host's next commands, applied on the end state in order. Throws when one no longer applies here. */
  append(commands: readonly Command[], checksums?: Readonly<Record<string, string>>): SeatSnapshot {
    const deps = this.#need();
    if (this.#commands.length + commands.length > MAX_SEAT_COMMANDS) throw new ReplayOpenError("damaged");
    this.#check.add(checksums);
    const from = this.#commands.length;
    const events: GameEvent[] = [];
    let states: ReturnType<typeof sealedEventStates> = [];
    let session = startSession(this.#stateOf());
    for (const command of commands) {
      const before = session.state;
      const result = sessionApply(session, command, deps, { recordStates: inVillainPhase });
      if (!result.ok) throw new Error(`the host's move no longer applies here: ${result.error.message}`);
      session = result.session;
      this.#push(command, before, result.events, result.session.state);
      events.push(...result.events);
      if (commands.length === 1) states = sealedEventStates(result.states ?? []);
    }
    this.#state = session.state;
    // One command plays as it was played (its events animate); a batch is a catch-up, shown as a resumed game.
    if (commands.length === 1) {
      return {
        ...this.#snapshot(events, { type: "append", from, commands }),
        ...(states.length > 0 ? { states } : {}),
      };
    }
    return this.#snapshot([], { type: "append", from, commands }, true);
  }

  /** The host cut its log to the first `to` commands. */
  rewind(to: number): SeatSnapshot {
    const target = Math.max(0, Math.min(Math.floor(to), this.#commands.length));
    const kept = this.#commands.slice(0, target);
    this.#check.truncateTo(target);
    this.#replayFrom(kept);
    return this.#snapshot([], { type: "rewind" }, true);
  }

  legalActions(playerId: PlayerId): LegalActions {
    if (!this.#holds(playerId)) return { kind: "notYourTurn", activePlayerId: null, legal: [], illegal: [] };
    return queryLegalActions(this.#stateOf(), playerId, this.#need());
  }

  judgePayment(playerId: PlayerId, payment: PaymentState): JudgedPayment {
    return { version: this.#commands.length, verdict: judgePayment(this.#stateOf(), playerId, payment, this.#need()) };
  }

  /** The first command count whose state differs from the one the host checksummed, or null. */
  get divergedAt(): number | null {
    return this.#check.divergedAt;
  }

  /**
   * The identity of the table a proposal made at `base` is built on (`replayChecksum` of the state, as the host takes it
   * when it judges): empty when this seat's table is not at `base`, which the host then reads as stale.
   */
  stampAt(base: number): string {
    return this.#state && base === this.#commands.length ? replayChecksum(this.#state) : "";
  }

  /** What a finished copy of this game needs (#909): the config as this seat knows it, the baseline without its pool, the log. */
  finishedInput(): {
    readonly config: NonNullable<Snapshot["config"]>;
    readonly initialState: StateWithoutPool;
    readonly commands: readonly Command[];
  } | null {
    if (!this.#config || !this.#initial) return null;
    const { cardPool: _cardPool, ...initialState } = this.#initial;
    return { config: this.#config, initialState, commands: [...this.#commands] };
  }

  get length(): number {
    return this.#commands.length;
  }

  get opened(): boolean {
    return this.#state !== null;
  }

  /** The seat's own state and the list of commands, from the baseline. */
  #replayFrom(commands: readonly Command[]): void {
    const deps = this.#need();
    const initial = this.#initial;
    if (!initial) throw new Error("the seat has no game");
    this.#commands = [];
    this.#events = [];
    this.#trail = [];
    this.#record = this.#baseRecord;
    let state = initial;
    for (const [index, command] of commands.entries()) {
      const result = applyCommand(state, command, deps);
      if (!result.ok) {
        throw new Error(`the room's game no longer replays here (command ${index + 1}: ${result.error.message})`);
      }
      this.#push(command, state, result.events, result.state);
      state = result.state;
    }
    this.#state = state;
  }

  #push(command: Command, before: GameState, events: readonly GameEvent[], after: GameState): void {
    this.#commands.push(command);
    this.#events.push(events);
    this.#trail.push({
      playerId: command.playerId,
      command,
      events,
      rngDraws: { before: before.rng.draws, after: after.rng.draws },
    });
    this.#record = recordEvents(this.#record, events, after, this.#need());
    this.#check.observe(this.#commands.length, after);
  }

  #history(): readonly GameEvent[] {
    return [...this.#setupEvents, ...this.#events.flat()];
  }

  /** Whether `playerId` is one of the heroes this device holds. */
  #holds(playerId: PlayerId): boolean {
    return this.#players.some((p) => p === playerId);
  }

  #snapshot(events: readonly GameEvent[], change: SeatChange, resumed = false): SeatSnapshot {
    const state = this.#stateOf();
    const deps = this.#need();
    const toAct = actingPlayer(state);
    // Legal actions are computed only for a hero this device holds; anyone else's turn is shown read-only.
    const legal: LegalActionsFor | null =
      toAct && this.#holds(toAct) ? { playerId: toAct, actions: queryLegalActions(state, toAct, deps) } : null;
    return {
      version: this.#commands.length,
      state: stripSealedPool(sealForTable(state)),
      events,
      legal,
      record: this.#record,
      saveError: null,
      config: this.#config,
      gameId: null,
      ...(resumed ? { history: this.#history(), trail: this.#trail } : {}),
      change,
    };
  }

  #stateOf(): GameState {
    if (!this.#state) throw new Error("the seat has no game");
    return this.#state;
  }

  #need(): EngineDeps {
    if (!this.#deps) throw new Error("the seat has no game");
    return this.#deps;
  }
}
