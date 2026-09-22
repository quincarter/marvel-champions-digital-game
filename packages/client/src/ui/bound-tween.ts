/**
 * A number counting from one value to another on screen — an HP plate ticking down, a threat meter filling — tied to
 * the game object it draws into.
 *
 * Such a tween animates a plain `{ value }` driver, not a game object, so destroying what it draws into does not stop
 * it: the Board redraws its whole display list on every state change (`destroyChildren`), and the old tween went on
 * calling `plate.update(...)` on a destroyed text. That threw inside Phaser's frame and stopped the game loop for good
 * (2026-09-21: "Hawkeye is down" froze the screen). Here the tween is removed the moment its owner is destroyed, and
 * never steps an owner that is no longer active.
 */
import type Phaser from "phaser";

export interface CountTweenOptions {
  readonly from: number;
  readonly to: number;
  readonly durationMs: number;
  readonly ease?: string;
  /** Called with the current value: once immediately, then every step. */
  readonly onStep: (value: number) => void;
}

export function countTween(
  scene: Phaser.Scene,
  owner: Phaser.GameObjects.GameObject,
  options: CountTweenOptions,
): void {
  const driver = { value: options.from };
  options.onStep(driver.value);
  const tween = scene.tweens.add({
    targets: driver,
    value: options.to,
    duration: options.durationMs,
    ease: options.ease ?? "Quad.easeOut",
    onUpdate: () => {
      if (!owner.active || !owner.scene) {
        tween.remove();
        return;
      }
      options.onStep(driver.value);
    },
  });
  owner.once("destroy", () => tween.remove());
}
