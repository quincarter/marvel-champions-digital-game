/**
 * A timer on the wall clock, for the few things that must end on time however slowly the game is drawing.
 *
 * Phaser's own timers (`scene.time.delayedCall`) count the frame delta, and the frame loop smooths it: any frame longer
 * than 200 ms (under 5 fps) is replaced by the last ordinary one (`Core.TimeStep#smoothDelta`). On a device that slow,
 * game time crawls at a few percent of real time, so a "closes itself after 2.5 s" overlay that takes the whole table's
 * input stays for a minute or more. An auto-dismiss that guards the player's input is a promise about real time and
 * uses this; animation and everything else stays on the scene clock.
 */

/** Runs `run` once after `ms` of real time. Returns a cancel function, safe to call after it has run. */
export function afterWallMs(ms: number, run: () => void): () => void {
  const handle = setTimeout(run, ms);
  return () => clearTimeout(handle);
}
