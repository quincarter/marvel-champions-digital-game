/**
 * The main-thread side of the pack load worker: one installed pack's files in, its `PackRuntime` or a skip reason out,
 * then the worker is ended. Where there is no `Worker` (Vitest, a browser that refuses one), or it cannot start, fails or
 * goes silent, the same load runs here, as `unpack-client.ts` does for installs.
 */
import type { PackManifest } from "@mc/content";
import { loadPackRuntime, type PackLoadResult } from "./pack-load.js";

export interface LoadWorkerRequest {
  readonly manifest: PackManifest;
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly requiredPackCards: readonly string[];
}
export type LoadWorkerReply = PackLoadResult;

/** The part of `Worker` used, so a test can stand in for it. */
export interface LoadWorkerLike {
  postMessage(message: LoadWorkerRequest): void;
  onmessage: ((event: { readonly data: LoadWorkerReply }) => void) | null;
  onmessageerror?: ((event: unknown) => void) | null | undefined;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

export type LoadWorkerFactory = () => LoadWorkerLike | null;

export const spawnLoadWorker: LoadWorkerFactory = () => {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./pack-load.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-pack-load",
    }) as unknown as LoadWorkerLike;
  } catch {
    return null;
  }
};

/** How long the worker may take before the load runs here instead. */
export const LOAD_IDLE_MS = 60_000;

export function loadInWorker(
  manifest: PackManifest,
  files: ReadonlyMap<string, Uint8Array>,
  requiredPackCards: ReadonlySet<string>,
  factory: LoadWorkerFactory = spawnLoadWorker,
  idleMs: number = LOAD_IDLE_MS,
): Promise<PackLoadResult> {
  const here = (): PackLoadResult => loadPackRuntime(manifest, files, requiredPackCards);
  const worker = factory();
  if (!worker) return Promise.resolve(here());
  return new Promise<PackLoadResult>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const end = (): void => {
      settled = true;
      clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const fallback = (): void => {
      if (settled) return;
      end();
      resolve(here());
    };
    worker.onmessage = (event) => {
      if (settled) return;
      end();
      resolve(event.data);
    };
    worker.onerror = fallback;
    worker.onmessageerror = fallback;
    timer = setTimeout(fallback, idleMs);
    try {
      worker.postMessage({ manifest, files, requiredPackCards: [...requiredPackCards] });
    } catch {
      fallback();
    }
  });
}
