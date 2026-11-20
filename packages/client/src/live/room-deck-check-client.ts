/**
 * The main-thread side of the room deck checker worker (`workers/room-deck-check.worker.ts`): sends the seats' decks, the
 * allowed mods and the loaded packs over once per Start and resolves with one verdict per seat. The worker lives only
 * for the check. Where it cannot be started (or it fails) the answer is `null`, never a quiet pass: a Start that cannot
 * judge the decks does not start.
 */
import type { RoomDeckCheckInput, SeatDeckVerdict } from "./room-deck.js";

/** What the worker is sent: the check's input without the base pool, which the worker evaluates itself. */
export interface RoomDeckCheckRequest {
  readonly id: number;
  readonly input: Omit<RoomDeckCheckInput, "basePool">;
}

/** The worker's answer; `verdicts` is null when it could not load the pool or the check threw. */
export interface RoomDeckCheckResponse {
  readonly id: number;
  readonly verdicts: readonly SeatDeckVerdict[] | null;
}

/** The part of `Worker` used, so a test can stand in for it. */
export interface CheckWorkerLike {
  postMessage(message: RoomDeckCheckRequest): void;
  onmessage: ((event: { readonly data: RoomDeckCheckResponse }) => void) | null;
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

/** Judges the decks in a worker; null when there is no worker or it failed. Always ends the worker. */
export function checkRoomDecksInWorker(
  input: RoomDeckCheckRequest["input"],
  factory: CheckWorkerFactory = spawnRoomDeckCheckWorker,
): Promise<readonly SeatDeckVerdict[] | null> {
  const worker = factory();
  if (!worker) return Promise.resolve(null);
  return new Promise((resolve) => {
    const finish = (verdicts: readonly SeatDeckVerdict[] | null): void => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      resolve(verdicts);
    };
    worker.onmessage = (event) => finish(event.data.id === 1 ? event.data.verdicts : null);
    worker.onerror = () => finish(null);
    worker.postMessage({ id: 1, input });
  });
}
