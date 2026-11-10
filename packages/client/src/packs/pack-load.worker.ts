/**
 * The pack load worker (`load-client.ts` owns it): validates one installed pack off the main thread, which hashes every
 * file and parses its cards and abilities. All the logic is `pack-load.ts`'s, which the tests call directly.
 */
import { loadPackRuntime } from "./pack-load.js";
import type { LoadWorkerReply, LoadWorkerRequest } from "./load-client.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used. */
interface WorkerGlobal {
  postMessage(message: LoadWorkerReply): void;
  onmessage: ((event: MessageEvent<LoadWorkerRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;

worker.onmessage = (event: MessageEvent<LoadWorkerRequest>) => {
  const { manifest, files, requiredPackCards } = event.data;
  worker.postMessage(loadPackRuntime(manifest, files, new Set(requiredPackCards)));
};
