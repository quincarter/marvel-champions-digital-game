/**
 * The room deck checker (`live/room-deck-check-client.ts` owns it): judges each seat's deck against the host's card pool
 * and allowed mods at Start, off the main thread. All the logic is `live/room-deck.ts`'s `checkRoomDecks`, which the
 * tests call directly; the pool is evaluated here, the first time a check is asked for.
 */
import type { RoomDeckCheckRequest, RoomDeckCheckResponse } from "../live/room-deck-check-client.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used. */
interface WorkerGlobal {
  postMessage(message: RoomDeckCheckResponse): void;
  onmessage: ((event: MessageEvent<RoomDeckCheckRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;

worker.onmessage = (event: MessageEvent<RoomDeckCheckRequest>) => {
  const { id, input } = event.data;
  void Promise.all([import("../live/room-deck.js"), import("../content/pool.js")]).then(
    ([{ checkRoomDecks }, { POOL_CARDS }]) => {
      try {
        worker.postMessage({ id, verdicts: checkRoomDecks({ ...input, basePool: POOL_CARDS }) });
      } catch {
        worker.postMessage({ id, verdicts: null });
      }
    },
    () => worker.postMessage({ id, verdicts: null }),
  );
};
