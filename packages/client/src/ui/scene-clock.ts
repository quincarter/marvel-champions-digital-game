/**
 * Brings a scene's clock up to the game's current frame time.
 *
 * Phaser reads `scene.time.now` from the frame loop only once the scene is running: the clock takes the loop's time
 * when the game boots every configured scene, and `Clock#start` does not refresh it when the scene starts, so inside
 * `create` (and anything `create` calls synchronously, like a store subscription's first delivery) `time.now` is
 * the time the game booted, or the last frame of the scene's previous run. Anything timed from it there — the Board's
 * opening "ROUND 1 · PLAYER PHASE" band — is timed from the past, and by the first real frame it has already
 * finished. Reported from play: the first game's opening band never showed, after Title, the comic and the mulligan
 * had run the clock on well past it.
 */
import type Phaser from "phaser";

export function syncSceneClock(scene: Pick<Phaser.Scene, "time" | "game">): void {
  scene.time.now = scene.game.loop.time;
}
