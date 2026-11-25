/**
 * The `EngineHost` a seated guest plays through (issue #881, docs/live-game-rooms.md section 9). The board and its store
 * take it in place of the local host while the guest is in the room's game (`platform/seat-play.ts`), so the table is
 * drawn and driven exactly as a local game is; the difference is in who decides.
 *
 * The room's host is the authority. This host follows the room's log in a seat worker (`seat-core.ts`: the whole engine,
 * off the main thread) and publishes the table after every command the room delivers. `dispatch` never applies
 * anything: it sends the command to the room as a proposal built on the log length it was made against, and settles
 * when the log answers: the command appears at that position (`ok`), something else took the position or the host turned
 * it down (`refused`, in words), or nothing came in time. A guest's own device never keeps the game: saves, storage and
 * rewinds are refused or empty here, and an Undo is a request to the host (`room-protocol.ts`), not a rewind.
 *
 * `legal` is filled only for a hero this device holds (`setPlayers`); for anyone else's turn the board is read-only.
 */
import type { Command, LegalActions, PlayerId } from "@mc/engine";
import type { SaveMeta } from "../engine/game-storage.js";
import type {
  CardPool,
  DispatchResult,
  EngineUpdate,
  EngineHost,
  SavedGame,
  SessionConfig,
  UpdateListener,
} from "../engine/host.js";
import { t } from "../i18n/translate.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { PaymentState } from "../view/payment-model.js";
import type { JudgedPayment } from "../view/payment-verdict.js";
import type { SeatPlayer, SeatSnapshot } from "./seat-core.js";
import type { SeatBackend, SeatEvent, SeatRefusal, SeatRequest, SeatResponse } from "./seat-protocol.js";

const REFUSED = "a seat plays through the room: this device does not keep the game";

/** How long a proposal waits for the log's answer before it is given up (the host is slow, or gone). */
export const PROPOSAL_TIMEOUT_MS = 15_000;

/** What a refusal says, in plain words in the player's language (`seat.refusal.*` in the catalogs). */
export function refusalMessage(reason: SeatRefusal): string {
  switch (reason) {
    case "stale":
      return t("seat.refusal.stale");
    case "not-your-turn":
      return t("seat.refusal.notYourTurn");
    case "illegal":
      return t("seat.refusal.illegal");
    case "strict":
      return t("seat.refusal.strict");
    case "build-mismatch":
      return t("seat.refusal.buildMismatch");
    case "not-seated":
      return t("seat.refusal.notSeated");
    case "not-away":
      return t("seat.refusal.notAway");
    case "handover-off":
      return t("seat.refusal.handoverOff");
    case "out-of-order":
      return t("seat.refusal.outOfOrder");
    case "rate-limited":
      return t("seat.refusal.rateLimited");
    default:
      return t("seat.refusal.generic");
  }
}

/** What the transport shows of the room's game. */
export interface SeatStatus {
  readonly hostConnected: boolean;
  /** The game ended, or the room closed: no more moves come. */
  readonly over: boolean;
  /** Following stopped because the game could not be read or applied here. */
  readonly failed: boolean;
  /** The first command count whose state differs from the host's checksum: this device has drifted from the room. */
  readonly divergedAt: number | null;
}

export const INITIAL_SEAT_STATUS: SeatStatus = { hostConnected: false, over: false, failed: false, divergedAt: null };

export interface SeatHostOptions {
  readonly proposalTimeoutMs?: number;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  /**
   * A seated player's Concede means leaving their seats, not ending the game for the table (Quin, 2026-11-20): this puts
   * their seats away, as if they had disconnected. The game goes on; the host may take a seat over or hand it on.
   */
  readonly leaveSeats?: () => void;
  /** A Competitive room's game: Concede is the seat's proposal (the team's forfeit, or leaving a 2v2 alone), not leaving the seat. */
  readonly proposesConcede?: () => boolean;
  /** Tests: fixes the id generation (default random per host) so proposal ids are predictable. */
  readonly pidGeneration?: number;
}

/** Proposal ids: `generation * PID_COUNTER_SPAN + counter`, a safe integer (2^30 * 2^22 = 2^52). */
const PID_COUNTER_SPAN = 2 ** 22;
const PID_GENERATIONS = 2 ** 30;

interface Pending {
  /** The id the proposal went out with: a refusal that names it fails this proposal and no other. */
  readonly pid: number;
  readonly base: number;
  readonly command: Command;
  readonly resolve: (result: DispatchResult) => void;
  timer: unknown;
  /** The host said it applied this proposal (by its `pid`): only then is the command at `base` in the log mine. */
  accepted: boolean;
  /** The room's log epoch the acceptance named; undefined from an older room. */
  acceptedEpoch?: number;
}

export class SeatEngineHost implements EngineHost {
  readonly #backend: SeatBackend;
  readonly #o: SeatHostOptions;
  readonly #listeners = new Set<UpdateListener>();
  readonly #statusListeners = new Set<(status: SeatStatus) => void>();
  readonly #pending: Pending[] = [];
  #cardPool: CardPool | null = null;
  #current: EngineUpdate | null = null;
  /** The room's log as this seat last read it, to tell a reconnect's reset of the same game from a rewind or another game. */
  #log: readonly Command[] = [];
  /**
   * The room's epoch for the log held (it changes whenever the host cuts the log back, replaces it or starts over); an
   * acceptance counts only for the epoch it names. Undefined until a change names one, or from an older room.
   */
  #epoch: number | undefined;
  #status: SeatStatus = INITIAL_SEAT_STATUS;
  #disposed = false;
  /**
   * Proposal ids are unique across seat-host lifetimes: a random generation in the high part, a counter from 1 in the
   * low part. A restarted host (new game, new feed) never reuses an id a delayed acceptance of the old one carries.
   */
  readonly #pidGeneration: number;
  #nextPid = 1;

  constructor(backend: SeatBackend, options: SeatHostOptions = {}) {
    this.#backend = backend;
    this.#o = options;
    this.#pidGeneration = options.pidGeneration ?? Math.floor(Math.random() * PID_GENERATIONS);
    backend.onEvent((event) => this.#onEvent(event));
  }

  /** Opens the room's game: settles with its first update once the game has arrived and is rebuilt here. */
  async join(): Promise<EngineUpdate> {
    const { cardPool, snapshot } = await this.#backend.open();
    this.#cardPool = cardPool;
    if (snapshot.change.type === "open" || snapshot.change.type === "reset") this.#log = [...snapshot.change.commands];
    const update = this.#hydrate(snapshot);
    this.#current = update;
    return update;
  }

  /** The heroes this device holds; the table is shown again with `legal` for them. */
  async setPlayers(players: readonly SeatPlayer[]): Promise<void> {
    const snapshot = await this.#backend.setPlayers(players);
    this.#publish(this.#hydrate(snapshot));
  }

  get status(): SeatStatus {
    return this.#status;
  }

  /** The transport's feed of the room's state. Delivers the current state at once. */
  onStatus(listener: (status: SeatStatus) => void): () => void {
    this.#statusListeners.add(listener);
    listener(this.#status);
    return () => this.#statusListeners.delete(listener);
  }

  /** Publishes the game's current position (the store's `open` calls this; the id is not read). */
  async resume(_gameId?: string): Promise<EngineUpdate> {
    const update = this.#current ?? (await this.join());
    this.#publish(update);
    return update;
  }

  async start(_config: SessionConfig): Promise<EngineUpdate> {
    throw new Error(REFUSED);
  }

  /**
   * Proposes `command` to the room's host, built on the log as it is now. Nothing is applied here: the result is the
   * log's own echo of it, or the reason it did not happen.
   */
  dispatch(command: Command): Promise<DispatchResult> {
    const current = this.#current;
    if (this.#disposed || !current) return Promise.resolve(this.#failed(command, t("seat.msg.notOpen")));
    if (this.#status.over || this.#status.failed) return Promise.resolve(this.#failed(command, t("seat.msg.over")));
    // Never a proposal: a seat's Concede is leaving the seat. The table is shown as it is, without this device's heroes.
    if (command.type === "concede" && this.#o.leaveSeats && !this.#o.proposesConcede?.()) {
      this.#o.leaveSeats();
      return Promise.resolve({ ok: true, update: current });
    }
    const base = current.version;
    return new Promise<DispatchResult>((resolve) => {
      const setTimer = this.#o.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms));
      const pending: Pending = {
        pid: this.#pidGeneration * PID_COUNTER_SPAN + this.#nextPid++,
        base,
        command,
        resolve,
        accepted: false,
        timer: setTimer(() => {
          // Only the host's acceptance by my `pid` makes a command at `base` mine; an identical command from another
          // seat is not, so with no acceptance or refusal this stays a failure.
          this.#settle(pending, this.#failed(command, t("seat.msg.noAnswer")));
        }, this.#o.proposalTimeoutMs ?? PROPOSAL_TIMEOUT_MS),
      };
      this.#pending.push(pending);
      this.#backend.propose(command, base, pending.pid);
    });
  }

  async rewindTo(_commandCount: number): Promise<EngineUpdate> {
    throw new Error(REFUSED);
  }

  legalActions(playerId: PlayerId): Promise<LegalActions> {
    return this.#backend.legalActions(playerId);
  }

  judgePayment(playerId: PlayerId, payment: PaymentState): Promise<JudgedPayment> {
    return this.#backend.judgePayment(playerId, payment);
  }

  subscribe(listener: UpdateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async save(): Promise<SavedGame> {
    throw new Error(REFUSED);
  }

  async latestSave(): Promise<SaveMeta | null> {
    return null;
  }

  async activeSaves(): Promise<readonly SaveMeta[]> {
    return [];
  }

  async retireSave(_gameId: string): Promise<void> {}

  async listSaves(): Promise<readonly SaveMeta[]> {
    return [];
  }

  async backfillSummaries(): Promise<number> {
    return 0;
  }

  dispose(): void {
    this.#disposed = true;
    for (const pending of [...this.#pending]) {
      this.#settle(pending, this.#failed(pending.command, t("seat.msg.left")));
    }
    this.#listeners.clear();
    this.#statusListeners.clear();
    this.#backend.dispose();
  }

  #onEvent(event: SeatEvent): void {
    if (this.#disposed) return;
    switch (event.type) {
      case "update":
        this.#onUpdate(event.snapshot, event.divergedAt, event.epoch);
        return;
      case "refused": {
        // A refusal names its proposal; one without an id (an older host) is the oldest built on that log length.
        const pending =
          event.pid === undefined
            ? this.#pending.find((p) => p.base === event.base)
            : this.#pending.find((p) => p.pid === event.pid);
        if (pending) this.#settle(pending, this.#failed(pending.command, refusalMessage(event.reason), event.reason));
        return;
      }
      case "accepted": {
        // The host names the proposal it applied by its id; one without an id (from an older seat) names none of ours.
        const pending = event.pid === undefined ? undefined : this.#pending.find((p) => p.pid === event.pid);
        // The base must be the one this proposal went out on: an acceptance of another position is not about it.
        if (!pending || pending.base !== event.base) return;
        pending.accepted = true;
        if (event.epoch !== undefined) pending.acceptedEpoch = event.epoch;
        const current = this.#current;
        // The host says it ahead of the log's echo. If the log is already past the base, what stands at the base decides:
        // my command (ok), or another (stale). A longer log alone proves nothing: a rewind and replacement lengthens it too.
        // A concession is applied at whatever count the host is at, so the log moving on says nothing about it.
        if (current && pending.command.type === "concede") {
          // Its echo may have come before the acceptance: the same rule as the append path decides.
          if (this.#concedeAt(pending, this.#log, 0) >= 0) this.#settle(pending, { ok: true, update: current });
        } else if (current && current.version > pending.base) {
          this.#settleOn(pending, this.#verdict(pending, this.#log[pending.base], false), current);
        }
        return;
      }
      case "epoch":
        this.#epoch = event.epoch;
        return;
      case "presence":
        this.#setStatus({ ...this.#status, hostConnected: event.hostConnected });
        return;
      case "over":
        this.#setStatus({ ...this.#status, over: true });
        this.#failAll(t("seat.msg.over"));
        return;
      case "failed":
        this.#setStatus({ ...this.#status, over: true, failed: true, hostConnected: false });
        this.#failAll(t("seat.msg.lost"));
        return;
    }
  }

  #onUpdate(snapshot: SeatSnapshot, divergedAt: number | null, epoch: number | undefined): void {
    const { change } = snapshot;
    const previousEpoch = this.#epoch;
    this.#epoch = epoch;
    // Which waiting proposals the host accepted: the command at the position one was built on is its own when the host
    // said so by its `pid`. An identical command from anyone else is not it (the host refuses mine as stale, by its
    // `pid`), so a command like mine that was not accepted waits for that refusal. A different command at the position
    // can only have beaten mine to it: that proposal is stale already.
    const landed: { pending: Pending; verdict: Verdict }[] = [];
    if (change.type === "append") {
      for (const pending of this.#pending) {
        if (pending.command.type === "concede") {
          // Never stale by position: the host applies a concession at the count it is at (the judge skips the base and
          // stamp check). It lands with its acceptance, as the first appended command at or after its base that says
          // the same thing; commands other seats got in first are theirs.
          if (this.#concedeAt(pending, change.commands, change.from) >= 0) landed.push({ pending, verdict: "ok" });
          continue;
        }
        const command = change.commands[pending.base - change.from];
        if (pending.base < change.from || command === undefined) continue;
        const verdict = this.#verdict(pending, command, false);
        if (verdict !== "wait") landed.push({ pending, verdict });
      }
    }
    const single = change.type === "append" && change.commands.length === 1 ? change.commands[0] : undefined;
    // Someone else's command is the store's to add to its trail; my own it adds itself on the reply.
    const remote = single && !landed.some((l) => l.verdict === "ok") ? single : undefined;
    const update = this.#hydrate(snapshot, remote ? { remote } : {});
    this.#publish(update);
    if (divergedAt !== this.#status.divergedAt) this.#setStatus({ ...this.#status, divergedAt });
    for (const { pending, verdict } of landed) this.#settleOn(pending, verdict, update);
    const previous = this.#log;
    if (change.type === "append") {
      // One command on the end of the log (the usual echo) is pushed in place; only an overlap copies.
      if (change.from === previous.length) (this.#log as Command[]).push(...change.commands);
      else this.#log = [...previous.slice(0, change.from), ...change.commands];
    } else if (change.type === "rewind") this.#log = previous.slice(0, snapshot.version);
    else if (change.type === "open" || change.type === "reset") this.#log = [...change.commands];
    // The log was cut back: a proposal waiting on the old log cannot be told apart from its echo.
    if (change.type === "rewind" || change.type === "open") this.#failAll(t("seat.msg.changed"));
    else if (change.type === "reset") this.#reconcileReset(previous, change.commands, update, previousEpoch);
  }

  /**
   * A reconnect brings the whole log again. When it extends the log held (the same game: the same commands up to the
   * shorter of the two) proposals stay: one the host accepted is mine when the new log has a command at its base,
   * and one still unanswered waits for its ledger result or its timeout. A log cut below a proposal's base, or another
   * game's, fails it.
   */
  #reconcileReset(
    previous: readonly Command[],
    next: readonly Command[],
    update: EngineUpdate,
    previousEpoch: number | undefined,
  ): void {
    // The room says the log under the table is another epoch than the one held (it was cut back, replaced or started
    // over while this seat was away): nothing waiting, and no receipt, belongs to this log, whatever its commands say.
    if (previousEpoch !== undefined && this.#epoch !== undefined && previousEpoch !== this.#epoch) {
      this.#failAll(t("seat.msg.changed"));
      return;
    }
    const shared = Math.min(previous.length, next.length);
    let sameGame = true;
    for (let i = 0; i < shared; i++) {
      const was = previous[i];
      const now = next[i];
      if (!was || !now || !sameCommand(was, now)) {
        sameGame = false;
        break;
      }
    }
    for (const pending of [...this.#pending]) {
      // A log that held the command at the base (or past it) and now stops at or before it was rewound: the proposal's
      // echo, or its acceptance, belongs to the log that was cut, and what is played at the base next is not it.
      const cutBack = previous.length > pending.base && next.length <= pending.base;
      if (!sameGame || next.length < pending.base || cutBack) {
        this.#settle(pending, this.#failed(pending.command, t("seat.msg.changed")));
        continue;
      }
      if (pending.command.type === "concede") {
        // Never stale by position (see the append path): it lands when the log holds it at or after its base.
        if (this.#concedeAt(pending, next, 0) >= 0) this.#settle(pending, { ok: true, update });
        continue;
      }
      this.#settleOn(pending, this.#verdict(pending, next[pending.base], true), update);
    }
  }

  #settleOn(pending: Pending, verdict: Verdict, update: EngineUpdate): void {
    if (verdict === "ok") this.#settle(pending, { ok: true, update });
    else if (verdict === "stale") this.#settle(pending, this.#failed(pending.command, refusalMessage("stale")));
    else if (verdict === "changed") this.#settle(pending, this.#failed(pending.command, t("seat.msg.changed")));
  }

  /**
   * Where an accepted concession stands in `commands` (which start at log position `from`): the first command at or
   * after its base that says the same thing, or -1 (also when the host has not accepted it yet).
   */
  #concedeAt(pending: Pending, commands: readonly Command[], from: number): number {
    if (!pending.accepted) return -1;
    return commands.findIndex((c, i) => from + i >= pending.base && sameCommand(c, pending.command));
  }

  /**
   * The one rule every settle path shares: a proposal is ok only when the command in the log at its base is the one
   * proposed AND the host accepted it by its `pid`. Another command there is stale; no command yet, or the same command
   * with no acceptance, waits for the ledger's answer or the timeout. A rewind below the base fails the proposal
   * before this is asked (`#reconcileReset`, the `rewind` change), so an acceptance held across one never reaches it.
   */
  #verdict(pending: Pending, command: Command | undefined, afterReset: boolean): Verdict {
    if (command === undefined) return "wait";
    if (!sameCommand(command, pending.command)) return "stale";
    if (!pending.accepted) return "wait";
    // An acceptance is for one epoch of the room's log: the one it names must be the one held. A room that names none
    // (an older one) proves nothing across a reconnect, where the log may have been cut and replayed: that waits for
    // the log's own echo (or the timeout) rather than settling ok.
    const named = pending.acceptedEpoch;
    if (named === undefined || this.#epoch === undefined) return afterReset ? "wait" : "ok";
    return named === this.#epoch ? "ok" : "changed";
  }

  #hydrate(snapshot: SeatSnapshot, extra: { readonly remote?: Command } = {}): EngineUpdate {
    const pool = this.#cardPool;
    if (!pool) throw new Error("the room's game is not open");
    const { change } = snapshot;
    return {
      version: snapshot.version,
      state: { ...snapshot.state, cardPool: pool },
      events: snapshot.events,
      legal: snapshot.legal,
      record: snapshot.record,
      saveError: null,
      config: snapshot.config,
      gameId: null,
      ...(snapshot.history ? { history: snapshot.history } : {}),
      ...(snapshot.trail ? { trail: snapshot.trail } : {}),
      ...(snapshot.states
        ? { states: snapshot.states.map(({ at, state }) => ({ at, state: { ...state, cardPool: pool } })) }
        : {}),
      ...(extra.remote ? { remote: extra.remote } : {}),
      ...(change.type === "rewind" || change.type === "reset" ? { rewound: true as const } : {}),
    };
  }

  #publish(update: EngineUpdate): void {
    this.#current = update;
    for (const listener of [...this.#listeners]) listener(update);
  }

  #setStatus(status: SeatStatus): void {
    this.#status = status;
    for (const listener of [...this.#statusListeners]) listener(status);
  }

  #settle(pending: Pending, result: DispatchResult): void {
    const at = this.#pending.indexOf(pending);
    if (at < 0) return;
    this.#pending.splice(at, 1);
    (this.#o.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(pending.timer);
    pending.resolve(result);
  }

  #failAll(message: string): void {
    for (const pending of [...this.#pending]) this.#settle(pending, this.#failed(pending.command, message));
  }

  #failed(command: Command, message: string, reason?: SeatRefusal): DispatchResult {
    return {
      ok: false,
      error: { code: reason === "not-your-turn" ? "not_active_player" : "internal_error", message, command },
    };
  }
}

type Verdict = "ok" | "stale" | "changed" | "wait";

/** Two commands are the same when they say the same thing (plain data, so its JSON is its identity). */
function sameCommand(a: Command, b: Command): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

type Pend = { readonly resolve: (response: SeatResponse) => void; readonly reject: (error: Error) => void };

/** How long the seat worker may take to open the room's game, and to answer anything after. */
export const SEAT_OPEN_DEADLINE_MS = 60_000;
export const SEAT_QUERY_DEADLINE_MS = 20_000;

/** The seat worker, started when the guest enters the room's game and terminated when they leave. */
export class WorkerSeatBackend implements SeatBackend {
  readonly #worker: Worker;
  readonly #feed: MessagePort;
  readonly #packs: readonly PackRuntime[];
  readonly #pending = new Map<number, Pend>();
  #listener: ((event: SeatEvent) => void) | null = null;
  #nextId = 1;

  /** `feed`: this end of the channel whose other end the room worker follows (`room-follow`). */
  constructor(
    feed: MessagePort,
    packs: readonly PackRuntime[],
    factory: () => Worker = () =>
      new Worker(new URL("../workers/seat.worker.ts", import.meta.url), { type: "module", name: "mc-seat" }),
  ) {
    this.#feed = feed;
    this.#packs = packs;
    this.#worker = factory();
    this.#worker.addEventListener("message", (event: MessageEvent<SeatResponse>) => {
      const response = event.data;
      if (response.kind === "event") {
        this.#listener?.(response.event);
        return;
      }
      const pending = this.#pending.get(response.id);
      if (!pending) return;
      this.#pending.delete(response.id);
      if (response.kind === "failed") pending.reject(new Error(response.message));
      else pending.resolve(response);
    });
    this.#worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "the seat worker failed");
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
      this.#listener?.({ type: "failed" });
    });
  }

  async open(): Promise<{ readonly cardPool: CardPool; readonly snapshot: SeatSnapshot }> {
    const response = await this.#request(
      { kind: "open", id: this.#nextId++, packs: this.#packs, feed: this.#feed },
      SEAT_OPEN_DEADLINE_MS,
      [this.#feed],
    );
    if (response.kind !== "opened") throw new Error(`unexpected reply ${response.kind}`);
    return { cardPool: response.cardPool, snapshot: response.snapshot };
  }

  propose(command: Command, base: number, pid: number): void {
    this.#worker.postMessage({ kind: "propose", id: this.#nextId++, command, base, pid } satisfies SeatRequest);
  }

  async setPlayers(players: readonly SeatPlayer[]): Promise<SeatSnapshot> {
    const response = await this.#request({ kind: "players", id: this.#nextId++, players }, SEAT_QUERY_DEADLINE_MS);
    if (response.kind !== "players") throw new Error(`unexpected reply ${response.kind}`);
    return response.snapshot;
  }

  async legalActions(playerId: PlayerId): Promise<LegalActions> {
    const response = await this.#request(
      { kind: "legalActions", id: this.#nextId++, playerId },
      SEAT_QUERY_DEADLINE_MS,
    );
    if (response.kind !== "legalActions") throw new Error(`unexpected reply ${response.kind}`);
    return response.actions;
  }

  async judgePayment(playerId: PlayerId, payment: PaymentState): Promise<JudgedPayment> {
    const response = await this.#request(
      { kind: "judgePayment", id: this.#nextId++, playerId, payment },
      SEAT_QUERY_DEADLINE_MS,
    );
    if (response.kind !== "paymentJudged") throw new Error(`unexpected reply ${response.kind}`);
    return response.judged;
  }

  onEvent(listener: (event: SeatEvent) => void): void {
    this.#listener = listener;
  }

  dispose(): void {
    this.#worker.terminate();
    const error = new Error("the seat closed");
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }

  #request(request: SeatRequest, deadlineMs: number, transfer: Transferable[] = []): Promise<SeatResponse> {
    return new Promise((resolve, reject) => {
      const deadline = setTimeout(() => {
        this.#worker.terminate();
        const error = new Error("the seat took too long");
        for (const pending of this.#pending.values()) pending.reject(error);
        this.#pending.clear();
        this.#listener?.({ type: "failed" });
      }, deadlineMs);
      this.#pending.set(request.id, {
        resolve: (response) => {
          clearTimeout(deadline);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(deadline);
          reject(error);
        },
      });
      this.#worker.postMessage(request, transfer);
    });
  }
}
