/**
 * Runs the progress math off the main thread (issue #722): `workers/progress.worker.ts` reads the campaign runs and
 * decks itself and answers with the result. Null when there is no worker, it fails, or it doesn't answer in time:
 * `refreshUnlocks` then reads and computes on the main thread, as before.
 */
import type { ProgressInputs, ProgressResult, ProgressSaves } from "./progress-compute.js";

export interface ProgressRequest {
  readonly id: number;
  readonly inputs: ProgressInputs;
  readonly saves: ProgressSaves;
}

export interface ProgressReply {
  readonly id: number;
  readonly result: ProgressResult | null;
  /** Sent once, when the worker has loaded its modules and can take requests. */
  readonly ready?: boolean;
}

/** How long a refresh waits on a worker that answers nothing before computing on the main thread instead. */
export const PROGRESS_WORKER_TIMEOUT_MS = 4000;
/** How long the worker may take to load its modules (the card pool, on a slow phone) before it is given up on. */
export const PROGRESS_WORKER_STARTUP_MS = 20000;

let worker: Worker | null | undefined;
let ready = false;
/** How many messages the worker has sent: a worker still answering is busy, not stuck. */
let answers = 0;
let nextId = 1;
const pending = new Map<number, (result: ProgressResult | null) => void>();

function progressWorker(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker === "undefined" || typeof indexedDB === "undefined") return null;
  try {
    const made = new Worker(new URL("../workers/progress.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-progress",
    });
    made.onmessage = (event: MessageEvent<ProgressReply>) => {
      answers++;
      if (event.data.ready) {
        ready = true;
        return;
      }
      pending.get(event.data.id)?.(event.data.result);
      pending.delete(event.data.id);
    };
    made.onerror = () => retire();
    worker = made;
  } catch {
    worker = null;
  }
  return worker;
}

/** Stops using the worker: everything waiting on it, and every later refresh, computes on the main thread. */
function retire(): void {
  const retired = worker;
  worker = null;
  ready = false;
  retired?.terminate();
  for (const settle of pending.values()) settle(null);
  pending.clear();
}

/** Forgets the worker (tests). */
export function resetProgressWorkerForTests(): void {
  retire();
  worker = undefined;
  answers = 0;
  nextId = 1;
}

/** The progress result computed in the worker, or null when the main thread should compute it itself. */
export function progressOffMain(inputs: ProgressInputs, saves: ProgressSaves): Promise<ProgressResult | null> {
  const computer = progressWorker();
  if (!computer) return Promise.resolve(null);
  const id = nextId++;
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let heard = answers;
    let timer: ReturnType<typeof setTimeout>;
    // Given more time while the worker is still loading (within its startup allowance) or still answering; retired
    // only once it has gone quiet.
    const expire = (): void => {
      const starting = !ready && Date.now() - startedAt < PROGRESS_WORKER_STARTUP_MS;
      if (worker === computer && (starting || answers !== heard)) {
        heard = answers;
        timer = setTimeout(expire, PROGRESS_WORKER_TIMEOUT_MS);
        return;
      }
      pending.delete(id);
      resolve(null);
      if (worker === computer) retire();
    };
    timer = setTimeout(expire, PROGRESS_WORKER_TIMEOUT_MS);
    pending.set(id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
    try {
      computer.postMessage({ id, inputs, saves } satisfies ProgressRequest);
    } catch {
      // Something in the saves that can't be cloned: compute here instead.
      clearTimeout(timer);
      pending.delete(id);
      resolve(null);
    }
  });
}
