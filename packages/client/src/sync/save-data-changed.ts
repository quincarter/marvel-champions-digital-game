/**
 * A tiny change signal for device sync: the storage classes call `notifySaveDataChanged` after a write commits, and
 * sync listens so it can push soon after instead of only on a timer. It carries no data (sync re-reads a snapshot),
 * only a reason. Listeners live in this realm: a write made inside the engine worker reaches only listeners
 * registered in the worker, so the main thread has to relay it (e.g. on the `flushed` replies it already gets).
 */
export type SaveDataChangeReason = "game" | "deck" | "campaign" | "progress" | "turn";

type Listener = (reason: SaveDataChangeReason) => void;

const listeners = new Set<Listener>();

/** Subscribes to changes; returns the unsubscribe function. */
export function onSaveDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tells listeners that save data changed. A listener that throws never breaks the write that called this. */
export function notifySaveDataChanged(reason: SaveDataChangeReason): void {
  for (const listener of [...listeners]) {
    try {
      listener(reason);
    } catch {
      // A sync bug must not surface as a failed save.
    }
  }
}
