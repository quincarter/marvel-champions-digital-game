/**
 * The main-thread side of the text-paint worker.
 *
 * `McLazyText` measures a label itself (layout needs its size at once) and hands the painting here as a `PaintJob`.
 * Jobs queued in one task go to the worker as one message; the worker paints each on an `OffscreenCanvas` and sends
 * back `ImageBitmap`s, which are put into the labels' textures a few at a time per frame, so a screen's hundreds of
 * uploads don't land in one task. Until its bitmap arrives a label draws nothing.
 *
 * - A label submitted again before its bitmap returns supersedes the first job; the first result is closed on
 *   arrival (`pending` only knows the newest id).
 * - A label destroyed meanwhile is forgotten the same way.
 * - The worker lives while it has work and for `TEXT_WORKER_IDLE_MS` after, then is ended and rebuilt on demand
 *   (`view/deck-search-client.ts` does the same). A rebuilt worker has to load the fonts again, so jobs submitted
 *   meanwhile wait for it (`everReady`); before the very first start, labels paint on the main thread.
 * - If the worker can't paint here (no OffscreenCanvas 2D, no fonts in workers, an error, too slow to start), every
 *   waiting label is painted on the main thread and the worker is not used again.
 */
import type { FontSource } from "../art/card-face-protocol.js";
import type { PaintJob, TextPaintRequest, TextPaintResponse } from "./text-paint-protocol.js";

/** The part of `Worker` used, so a test can stand in for it. */
export interface PaintWorkerLike {
  postMessage(message: TextPaintRequest): void;
  onmessage: ((event: { readonly data: TextPaintResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

/** What the painter needs from a label. */
export interface PaintTarget {
  /** Puts a finished bitmap into the label's texture. */
  applyBitmap(bitmap: ImageBitmap, canvasWidth: number, canvasHeight: number, resolution: number): void;
  /** Paints the label the way Phaser does, because the worker can't. */
  paintOnMain(): void;
  /** False once the label is destroyed. */
  readonly active: boolean;
}

export interface PainterDeps {
  /** A worker, or null where workers (or what the text worker needs) are unavailable. */
  spawn: () => PaintWorkerLike | null;
  fonts: () => readonly FontSource[];
  now: () => number;
  /** Runs `fn` after the current task: the end of the frame that submitted the jobs. */
  afterTask: (fn: () => void) => void;
  /** Runs `fn` on the next animation frame. */
  nextFrame: (fn: () => void) => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

/** How long the worker lives after its last result with nothing pending. */
export const TEXT_WORKER_IDLE_MS = 5000;
/** How long a (re)starting worker may take to load its fonts before labels are painted on the main thread. */
export const TEXT_WORKER_START_MS = 3000;
/** Time spent putting bitmaps into textures per frame. At least one goes in each frame. */
export const APPLY_BUDGET_MS = 8;

interface Pending {
  readonly target: PaintTarget;
  /** The size Phaser gives the label's frame: the canvas size before it is truncated to whole pixels. */
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly resolution: number;
}

export type PainterMode = "idle" | "starting" | "ready" | "off";

export class TextPainter {
  readonly #deps: PainterDeps;
  #mode: PainterMode = "idle";
  #worker: PaintWorkerLike | null = null;
  /** The worker has loaded its fonts at least once, so a restart is worth waiting for. */
  #everReady = false;
  #nextId = 1;
  readonly #pending = new Map<number, Pending>();
  #queue: PaintJob[] = [];
  #flushQueued = false;
  readonly #arrived: { readonly id: number; readonly bitmap: ImageBitmap }[] = [];
  #applyQueued = false;
  #idleTimer: unknown = null;
  #startTimer: unknown = null;

  constructor(deps: PainterDeps) {
    this.#deps = deps;
  }

  get mode(): PainterMode {
    return this.#mode;
  }

  get pendingCount(): number {
    return this.#pending.size;
  }

  /**
   * Whether a label should be handed to the worker now. Starts the worker when it is the first label in a while;
   * the label that asked paints on the main thread unless the worker has been up before (then it waits).
   */
  wants(): boolean {
    if (this.#mode === "off") return false;
    if (this.#mode === "idle") this.#start();
    return this.#usable();
  }

  /** After a start attempt: the worker is up, or was up before and is on its way back. */
  #usable(): boolean {
    const mode: PainterMode = this.#mode;
    return mode === "ready" || (mode === "starting" && this.#everReady);
  }

  /** Queues a paint and returns its id. The target's earlier job (`supersedes`) is dropped. */
  submit(
    target: PaintTarget,
    supersedes: number | undefined,
    job: Omit<PaintJob, "id">,
    frame: { readonly width: number; readonly height: number },
  ): number {
    if (supersedes !== undefined) this.#pending.delete(supersedes);
    const id = this.#nextId++;
    this.#pending.set(id, {
      target,
      canvasWidth: frame.width,
      canvasHeight: frame.height,
      resolution: job.resolution,
    });
    this.#queue.push({ ...job, id });
    this.#clearIdle();
    if (!this.#flushQueued) {
      this.#flushQueued = true;
      this.#deps.afterTask(() => this.#post());
    }
    return id;
  }

  /** The label no longer wants job `id` (destroyed, or being painted on the main thread). */
  forget(id: number | undefined): void {
    if (id !== undefined) this.#pending.delete(id);
  }

  /** Ends the worker now (a game being torn down, a test). */
  destroy(): void {
    this.#stopWorker();
    this.#fail();
    this.#mode = "idle";
  }

  #start(): void {
    let worker: PaintWorkerLike | null;
    try {
      worker = this.#deps.spawn();
    } catch {
      worker = null;
    }
    if (!worker) {
      this.#mode = "off";
      return;
    }
    this.#worker = worker;
    this.#mode = "starting";
    worker.onmessage = (event) => this.#onMessage(worker, event.data);
    worker.onerror = () => {
      if (this.#worker === worker) this.#giveUp();
    };
    this.#startTimer = this.#deps.setTimer(() => {
      if (this.#mode === "starting") this.#giveUp();
    }, TEXT_WORKER_START_MS);
    worker.postMessage({ type: "init", fonts: this.#deps.fonts() });
  }

  #onMessage(from: PaintWorkerLike, message: TextPaintResponse): void {
    if (from !== this.#worker) {
      if (message.type === "painted") for (const result of message.results) result.bitmap.close();
      return;
    }
    switch (message.type) {
      case "ready":
        this.#deps.clearTimer(this.#startTimer);
        if (!message.ok) {
          this.#giveUp();
          return;
        }
        this.#mode = "ready";
        this.#everReady = true;
        this.#post();
        this.#armIdle();
        return;
      case "painted":
        for (const result of message.results) this.#arrived.push(result);
        this.#scheduleApply();
        return;
      case "failed":
        for (const id of message.ids) this.#paintHere(id);
        this.#armIdle();
        return;
    }
  }

  #post(): void {
    this.#flushQueued = false;
    if (this.#mode !== "ready" || !this.#worker) return;
    const jobs = this.#queue.filter((job) => this.#pending.has(job.id));
    this.#queue = [];
    if (jobs.length > 0) this.#worker.postMessage({ type: "paint", jobs });
  }

  #scheduleApply(): void {
    if (this.#applyQueued || this.#arrived.length === 0) return;
    this.#applyQueued = true;
    this.#deps.nextFrame(() => {
      this.#applyQueued = false;
      this.#apply();
    });
  }

  #apply(): void {
    const started = this.#deps.now();
    while (this.#arrived.length > 0) {
      const { id, bitmap } = this.#arrived.shift()!;
      const entry = this.#pending.get(id);
      this.#pending.delete(id);
      if (!entry || !entry.target.active) {
        bitmap.close();
      } else {
        entry.target.applyBitmap(bitmap, entry.canvasWidth, entry.canvasHeight, entry.resolution);
      }
      if (this.#deps.now() - started >= APPLY_BUDGET_MS) break;
    }
    this.#scheduleApply();
    this.#armIdle();
  }

  #paintHere(id: number): void {
    const entry = this.#pending.get(id);
    this.#pending.delete(id);
    if (entry?.target.active) entry.target.paintOnMain();
  }

  /** The worker can't paint: do everything waiting on the main thread and stop using it. */
  #giveUp(): void {
    this.#stopWorker();
    this.#mode = "off";
    this.#fail();
  }

  #fail(): void {
    const ids = [...this.#pending.keys()];
    this.#queue = [];
    for (const { bitmap } of this.#arrived.splice(0)) bitmap.close();
    for (const id of ids) this.#paintHere(id);
  }

  #stopWorker(): void {
    this.#deps.clearTimer(this.#startTimer);
    this.#clearIdle();
    this.#worker?.terminate();
    this.#worker = null;
  }

  #clearIdle(): void {
    if (this.#idleTimer !== null) this.#deps.clearTimer(this.#idleTimer);
    this.#idleTimer = null;
  }

  /** Ends the worker after `TEXT_WORKER_IDLE_MS` with nothing pending. */
  #armIdle(): void {
    this.#clearIdle();
    if (this.#mode !== "ready" || this.#pending.size > 0 || this.#arrived.length > 0) return;
    this.#idleTimer = this.#deps.setTimer(() => {
      this.#idleTimer = null;
      if (this.#mode !== "ready" || this.#pending.size > 0) return;
      this.#stopWorker();
      this.#mode = "idle";
    }, TEXT_WORKER_IDLE_MS);
  }
}
