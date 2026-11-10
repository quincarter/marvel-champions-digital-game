/**
 * The main-thread side of the pack install worker: one zip in, the verified pack out, then the worker is ended. Where
 * there is no `Worker` (Vitest, a browser that refuses one), or it cannot start, the same unpack runs here.
 */
import type { PackManifest } from "@mc/content";
import {
  PackInstallError,
  unpackPack,
  type PackInstallErrorCode,
  type UnpackExpect,
  type UnpackProgress,
  type UnpackedPack,
} from "./unpack-pack.js";

export interface UnpackWorkerRequest {
  readonly zip: Uint8Array;
  readonly expect: UnpackExpect;
}

export type UnpackWorkerReply =
  | { readonly kind: "progress"; readonly progress: UnpackProgress }
  | { readonly kind: "done"; readonly manifest: PackManifest; readonly files: Map<string, Uint8Array> }
  | { readonly kind: "error"; readonly code: PackInstallErrorCode; readonly message: string };

/** The part of `Worker` used, so a test can stand in for it. */
export interface UnpackWorkerLike {
  postMessage(message: UnpackWorkerRequest, transfer?: Transferable[]): void;
  onmessage: ((event: { readonly data: UnpackWorkerReply }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

export type UnpackWorkerFactory = () => UnpackWorkerLike | null;

export const spawnUnpackWorker: UnpackWorkerFactory = () => {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./pack-install.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-pack-install",
    }) as unknown as UnpackWorkerLike;
  } catch {
    return null;
  }
};

/** Verifies and unpacks `zip` in a worker; here when there is no worker or it fails to start. */
export function unpackInWorker(
  zip: Uint8Array,
  expect: UnpackExpect,
  onProgress: (progress: UnpackProgress) => void = () => {},
  factory: UnpackWorkerFactory = spawnUnpackWorker,
): Promise<UnpackedPack> {
  const worker = factory();
  if (!worker) return unpackPack(zip, expect, onProgress);
  return new Promise<UnpackedPack>((resolve, reject) => {
    const end = (): void => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };
    worker.onmessage = (event) => {
      const reply = event.data;
      if (reply.kind === "progress") return onProgress(reply.progress);
      end();
      if (reply.kind === "done") resolve({ manifest: reply.manifest, files: reply.files });
      else reject(new PackInstallError(reply.code, reply.message));
    };
    worker.onerror = () => {
      // The worker itself failed (not a verification error): run the same check here.
      end();
      unpackPack(zip, expect, onProgress).then(resolve, reject);
    };
    try {
      // The zip is copied, not transferred, so the fallback above still has it.
      worker.postMessage({ zip, expect });
    } catch {
      end();
      unpackPack(zip, expect, onProgress).then(resolve, reject);
    }
  });
}
