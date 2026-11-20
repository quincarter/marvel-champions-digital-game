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
}

interface Pending {
  /** The id the proposal went out with: a refusal that names it fails this proposal and no other. */
  readonly pid: number;
  readonly base: number;
  readonly command: Command;
  readonly resolve: (result: DispatchResult) => void;
  timer: unknown;
}

export class SeatEngineHost implements EngineHost {
  readonly #backend: SeatBackend;
  readonly #o: SeatHostOptions;
  readonly #listeners = new Set<UpdateListener>();
  readonly #statusListeners = new Set<(status: SeatStatus) => void>();
  readonly #pending: Pending[] = [];
  #cardPool: CardPool | null = null;
  #current: EngineUpdate | null = null;
  #status: SeatStatus = INITIAL_SEAT_STATUS;
  #disposed = false;
  #nextPid = 1;

  constructor(backend: SeatBackend, options: SeatHostOptions = {}) {
    this.#backend = backend;
    this.#o = options;
    backend.onEvent((event) => this.#onEvent(event));
  }

  /** Opens the room's game: settles with its first update once the game has arrived and is rebuilt here. */
  async join(): Promise<EngineUpdate> {
    const { cardPool, snapshot } = await this.#backend.open();
    this.#cardPool = cardPool;
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
        pid: this.#nextPid++,
        base,
        command,
        resolve,
        timer: setTimer(() => {
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
        this.#onUpdate(event.snapshot, event.divergedAt);
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

  #onUpdate(snapshot: SeatSnapshot, divergedAt: number | null): void {
    const { change } = snapshot;
    // Which waiting proposal this command is the echo of (the same command at the position it was built on), and which
    // lost the position to someone else's command (the host will refuse it as stale; no need to wait for that).
    const landed: { pending: Pending; result: "ok" | "taken" }[] = [];
    if (change.type === "append") {
      // One appended command is one proposal's echo: of several identical proposals built on the same log length only
      // the oldest is acknowledged (the host takes the first and refuses the rest as stale).
      const claimed = new Set<number>();
      for (const pending of this.#pending) {
        const at = pending.base - change.from;
        const command = change.commands[at];
        if (at < 0 || command === undefined) continue;
        const echo = sameCommand(command, pending.command) && !claimed.has(at);
        if (echo) claimed.add(at);
        landed.push({ pending, result: echo ? "ok" : "taken" });
      }
    }
    const single = change.type === "append" && change.commands.length === 1 ? change.commands[0] : undefined;
    // Someone else's command is the store's to add to its trail; my own it adds itself on the reply.
    const remote = single && !landed.some((l) => l.result === "ok") ? single : undefined;
    const update = this.#hydrate(snapshot, remote ? { remote } : {});
    this.#publish(update);
    if (divergedAt !== this.#status.divergedAt) this.#setStatus({ ...this.#status, divergedAt });
    for (const { pending, result } of landed) {
      this.#settle(
        pending,
        result === "ok" ? { ok: true, update } : this.#failed(pending.command, refusalMessage("stale")),
      );
    }
    // The log was cut back or read again: a proposal waiting on the old log cannot be told apart from its echo.
    if (change.type === "rewind" || change.type === "open" || change.type === "reset") {
      this.#failAll(t("seat.msg.changed"));
    }
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
