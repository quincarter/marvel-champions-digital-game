/**
 * The room deck worker (`live/room-deck-check-client.ts` owns it): keeps the custom packs main sent it, turns a player's
 * deck into the room's list, and judges every seat's deck against the host's pool and allowed mods at Start. All the
 * logic is `live/room-deck.ts`'s, which the tests call directly; the pool is evaluated here, the first time a check is
 * asked for.
 */
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { RoomDeckRequest, RoomDeckResponse } from "../live/room-deck-check-client.js";
import { checkRoomDecks, roomDeckOf } from "../live/room-deck.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used. */
interface WorkerGlobal {
  postMessage(message: RoomDeckResponse): void;
  onmessage: ((event: MessageEvent<RoomDeckRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;
const packs = new Map<string, PackRuntime>();
const keyOf = (pack: { id: string; version: string }): string => `${pack.id}@${pack.version}`;
const packsFor = (keys: readonly { id: string; version: string }[]): PackRuntime[] =>
  keys.flatMap((key) => packs.get(keyOf(key)) ?? []);

worker.onmessage = (event: MessageEvent<RoomDeckRequest>) => {
  const message = event.data;
  if (message.op === "packs") {
    for (const pack of message.packs) packs.set(keyOf(pack), pack);
    return;
  }
  if (message.op === "deck") {
    try {
      worker.postMessage({
        id: message.id,
        op: "deck",
        deck: roomDeckOf(message.deck, message.heroName, packsFor(message.loaded)),
      });
    } catch {
      worker.postMessage({ id: message.id, op: "deck", deck: null, failed: true });
    }
    return;
  }
  void import("../content/pool.js").then(
    ({ POOL_CARDS }) => {
      try {
        const verdicts = checkRoomDecks({ ...message.input, loaded: packsFor(message.loaded), basePool: POOL_CARDS });
        worker.postMessage({ id: message.id, op: "check", verdicts });
      } catch {
        worker.postMessage({ id: message.id, op: "check", verdicts: null });
      }
    },
    () => worker.postMessage({ id: message.id, op: "check", verdicts: null }),
  );
};
