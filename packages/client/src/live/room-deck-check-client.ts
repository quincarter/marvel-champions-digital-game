/**
 * The main-thread side of the room deck worker (`workers/room-deck-check.worker.ts`). Everything that reads a deck's
 * cards or a pack's cards runs there: turning a player's deck into the room's list (which packs its cards come from) and
 * judging every seat's deck at Start. The worker keeps the loaded packs it has been sent, so each pack crosses once
 * (main posts only the ones the worker lacks), and it ends after a quiet minute. Where it cannot be started (or it
 * fails) the answer is a failure, never a quiet pass: a Start that cannot judge the decks does not start.
 */
import type { Deck } from "@mc/content";
import type { RoomDeck } from "@mc/sync-worker/room-protocol";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { RoomDeckCheckInput, SeatDeckVerdict } from "./room-deck.js";

/** A loaded pack by identity; the worker looks the pack itself up in what it was sent. */
export interface PackKey {
  readonly id: string;
  readonly version: string;
}

export type RoomDeckRequest =
  | { readonly id: number; readonly op: "packs"; readonly packs: readonly PackRuntime[] }
  | {
      readonly id: number;
      readonly op: "deck";
      readonly deck: Deck;
      readonly heroName: string;
      readonly loaded: readonly PackKey[];
    }
  | {
      readonly id: number;
      readonly op: "check";
      readonly input: Omit<RoomDeckCheckInput, "basePool" | "loaded">;
      readonly loaded: readonly PackKey[];
    };

/** The worker's answers: `deck` is null over the room's size cap, `verdicts` null when the work failed. */
export type RoomDeckResponse =
  | { readonly id: number; readonly op: "deck"; readonly deck: RoomDeck | null; readonly failed?: true }
  | { readonly id: number; readonly op: "check"; readonly verdicts: readonly SeatDeckVerdict[] | null };

/** The part of `Worker` used, so a test can stand in for it. */
export interface CheckWorkerLike {
  postMessage(message: RoomDeckRequest): void;
  onmessage: ((event: { readonly data: RoomDeckResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

export type CheckWorkerFactory = () => CheckWorkerLike | null;

/** The app's worker, or null where workers are unavailable. */
export const spawnRoomDeckCheckWorker: CheckWorkerFactory = () => {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../workers/room-deck-check.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-room-deck-check",
    }) as unknown as CheckWorkerLike;
  } catch {
    return null;
  }
};

/** How long the worker lives after its last answer. */
export const ROOM_DECK_WORKER_IDLE_MS = 60_000;

/** How long one request may go unanswered before the worker is taken to be hung (big custom packs validate slowly). */
export const ROOM_DECK_REQUEST_TIMEOUT_MS = 30_000;

const keyOf = (pack: PackKey): string => `${pack.id}@${pack.version}`;

export type RoomDeckResult =
  | { readonly ok: true; readonly deck: RoomDeck }
  | { readonly ok: false; readonly reason: "too-large" | "failed" };

export class RoomDeckWorker {
  readonly #factory: CheckWorkerFactory;
  readonly #idleMs: number;
  readonly #requestMs: number;
  readonly #timers = new Map<number, ReturnType<typeof setTimeout>>();
  #worker: CheckWorkerLike | null = null;
  /** Packs the live worker already holds. */
  #sent = new Set<string>();
  readonly #pending = new Map<number, (response: RoomDeckResponse | null) => void>();
  #nextId = 0;
  #idle: ReturnType<typeof setTimeout> | null = null;

  constructor(
    factory: CheckWorkerFactory = spawnRoomDeckCheckWorker,
    idleMs = ROOM_DECK_WORKER_IDLE_MS,
    requestMs = ROOM_DECK_REQUEST_TIMEOUT_MS,
  ) {
    this.#factory = factory;
    this.#idleMs = idleMs;
    this.#requestMs = requestMs;
  }

  #start(): CheckWorkerLike | null {
    if (this.#worker) return this.#worker;
    const worker = this.#factory();
    if (!worker) return null;
    worker.onmessage = (event) => {
      if (this.#worker !== worker) return;
      this.#settle(event.data.id);
      this.#pending.get(event.data.id)?.(event.data);
      this.#pending.delete(event.data.id);
      this.#armIdle();
    };
    worker.onerror = () => {
      if (this.#worker === worker) this.#fail();
    };
    this.#worker = worker;
    return worker;
  }

  #settle(id: number): void {
    const timer = this.#timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    this.#timers.delete(id);
  }

  #fail(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    const waiting = [...this.#pending.values()];
    this.#pending.clear();
    this.#end();
    for (const done of waiting) done(null);
  }

  #end(): void {
    if (this.#idle !== null) clearTimeout(this.#idle);
    this.#idle = null;
    this.#worker?.terminate();
    this.#worker = null;
    this.#sent = new Set();
  }

  #armIdle(): void {
    if (this.#idle !== null) clearTimeout(this.#idle);
    this.#idle = setTimeout(() => {
      this.#idle = null;
      if (this.#pending.size === 0) this.#end();
    }, this.#idleMs);
  }

  /** Posts the packs the worker lacks (each crosses once). */
  #sync(worker: CheckWorkerLike, packs: readonly PackRuntime[]): void {
    const fresh = packs.filter((pack) => !this.#sent.has(keyOf(pack)));
    if (fresh.length === 0) return;
    worker.postMessage({ id: ++this.#nextId, op: "packs", packs: fresh });
    for (const pack of fresh) this.#sent.add(keyOf(pack));
  }

  #ask(worker: CheckWorkerLike, build: (id: number) => RoomDeckRequest): Promise<RoomDeckResponse | null> {
    if (this.#idle !== null) clearTimeout(this.#idle);
    this.#idle = null;
    return new Promise((resolve) => {
      const id = ++this.#nextId;
      this.#pending.set(id, resolve);
      // A worker that is alive but hung never answers or errors: fail every waiting check closed and end it, so the
      // next request starts a fresh one and the host can press Start again.
      this.#timers.set(
        id,
        setTimeout(() => this.#fail(), this.#requestMs),
      );
      worker.postMessage(build(id));
    });
  }

  /**
   * A deck as the room carries it, built in the worker. `packs` are the loaded packs: only those the worker lacks are
   * sent. `too-large` is over the room's size cap, `failed` is no worker or a worker that failed.
   */
  async deck(deck: Deck, heroName: string, packs: readonly PackRuntime[]): Promise<RoomDeckResult> {
    const worker = this.#start();
    if (!worker) return { ok: false, reason: "failed" };
    this.#sync(worker, packs);
    const loaded = packs.map((pack) => ({ id: pack.id, version: pack.version }));
    const answer = await this.#ask(worker, (id) => ({ id, op: "deck", deck, heroName, loaded }));
    if (!answer || answer.op !== "deck" || answer.failed) return { ok: false, reason: "failed" };
    return answer.deck ? { ok: true, deck: answer.deck } : { ok: false, reason: "too-large" };
  }

  /**
   * Judges the decks in the worker; null when there is no worker or it failed. `loaded` are every pack on this device
   * (they take part by id and version); only `needed` (the allowed ones and what they require) are sent whole.
   */
  async check(
    input: Omit<RoomDeckCheckInput, "basePool" | "loaded">,
    loaded: readonly PackRuntime[],
    needed: readonly PackRuntime[],
  ): Promise<readonly SeatDeckVerdict[] | null> {
    const worker = this.#start();
    if (!worker) return null;
    this.#sync(worker, needed);
    const keys = loaded.map((pack) => ({ id: pack.id, version: pack.version }));
    const answer = await this.#ask(worker, (id) => ({ id, op: "check", input, loaded: keys }));
    return answer && answer.op === "check" ? answer.verdicts : null;
  }

  /**
   * Starts the worker and sends it the packs ahead of a deck, so the first Pick does not wait for the worker to boot
   * (a phone takes seconds) or for the packs to cross. Nothing to answer; an idle worker still ends after its quiet minute.
   */
  warm(packs: readonly PackRuntime[]): void {
    const worker = this.#start();
    if (!worker) return;
    this.#sync(worker, packs);
    this.#armIdle();
  }

  /** The room is left: ends the worker now. */
  destroy(): void {
    this.#fail();
  }
}
