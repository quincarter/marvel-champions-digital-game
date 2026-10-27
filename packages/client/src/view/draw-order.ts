/**
 * Draw order from a game object's index path (Phaser's `getIndexList()`: its index in the scene's display list, then
 * in each container down to the object). Of two paths, the one drawn later is on top.
 */

/** Whether the object at path `a` is drawn above the one at `b`. Equal paths are not above each other. */
export function drawnAbove(a: readonly number[], b: readonly number[]): boolean {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i++) {
    if (a[i] !== b[i]) return a[i]! > b[i]!;
  }
  // One sits inside the other's container: a container's children draw over the container itself.
  return a.length > b.length;
}
