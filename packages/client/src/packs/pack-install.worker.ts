/**
 * The pack install worker (`unpack-client.ts` owns it): hashes and unzips a downloaded pack off the main thread.
 * All the logic is `unpack-pack.ts`'s, which the tests call directly.
 */
import { PackInstallError, unpackPack, type UnpackExpect } from "./unpack-pack.js";
import type { UnpackWorkerReply, UnpackWorkerRequest } from "./unpack-client.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used. */
interface WorkerGlobal {
  postMessage(message: UnpackWorkerReply, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<UnpackWorkerRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;

worker.onmessage = (event: MessageEvent<UnpackWorkerRequest>) => {
  const { zip, expect } = event.data as { zip: Uint8Array; expect: UnpackExpect };
  unpackPack(zip, expect, (progress) => worker.postMessage({ kind: "progress", progress })).then(
    ({ manifest, files }) => {
      const transfer = [...files.values()].map((bytes) => bytes.buffer as ArrayBuffer);
      worker.postMessage({ kind: "done", manifest, files }, transfer);
    },
    (error: unknown) =>
      worker.postMessage({
        kind: "error",
        code: error instanceof PackInstallError ? error.code : "unzip",
        message: error instanceof Error ? error.message : String(error),
      }),
  );
};
