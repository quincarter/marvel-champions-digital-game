/**
 * Phaser's keyboard plugin re-runs its whole per-frame queue on every DOM key event (`MANAGER_PROCESS` is emitted by
 * each keydown and keyup), and only drops a repeat when it is the same key, timestamp and type as the last one it
 * delivered. A chord that lands inside one frame (Shift+Tab: Shift down, Tab down, Tab up, Shift up) therefore reaches
 * a scene's `keydown` listener three times over, and a single Shift+Tab moved focus three stops back.
 *
 * `once()` answers true the first time it sees a given event object and false for every redelivery of that same object.
 */
export function eventOnce(): (event: object) => boolean {
  const seen = new WeakSet<object>();
  return (event) => {
    if (seen.has(event)) return false;
    seen.add(event);
    return true;
  };
}
