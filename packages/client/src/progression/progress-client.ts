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
}

/** How long a refresh waits for the worker before computing on the main thread instead. */
export const PROGRESS_WORKER_TIMEOUT_MS = 4000;

let worker: Worker | null | undefined;
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
  retired?.terminate();
  for (const settle of pending.values()) settle(null);
  pending.clear();
}

/** The progress result computed in the worker, or null when the main thread should compute it itself. */
export function progressOffMain(inputs: ProgressInputs, saves: ProgressSaves): Promise<ProgressResult | null> {
  const computer = progressWorker();
  if (!computer) return Promise.resolve(null);
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(null);
      if (worker === computer) retire();
    }, PROGRESS_WORKER_TIMEOUT_MS);
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
