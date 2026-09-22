/**
 * Keeps one bad frame from ending the game.
 *
 * Phaser runs every frame inside its own `requestAnimationFrame` callback and only asks for the next frame after the
 * current one returns. So an exception thrown anywhere inside a frame — a tween's `onUpdate`, a timer callback, a
 * scene's `update` — ends the loop for good: the canvas keeps the last frame it drew, animations stop mid-flight, and
 * nothing is ever clicked again, while the page around it (the store, the debug shortcut) carries on. That is the
 * "frozen screen, a refresh fixed it" of 2026-09-21: a hero going down redrew the table while an HP counter was still
 * counting, the counter's tween wrote into the destroyed plate, and the throw took the whole game with it.
 *
 * Two nets, both of which log and record the error rather than hide it:
 *  - **Tween callbacks.** An exception from a tween's own callback removes *that tween* and nothing else. A throwing
 *    tween otherwise stays alive and throws again on every frame, before anything renders.
 *  - **The frame itself.** Anything else that throws skips the rest of that one frame; the loop carries on.
 *
 * The recorded errors ride along in the Ctrl+Shift+D snapshot (`ui/debug-dump.ts`), so a report names the error.
 */
import Phaser from "phaser";

import { recordError } from "./error-log.js";

export { recentErrors, recordError } from "./error-log.js";

type Dispatch = (this: unknown, event: string, callback: string) => void;

/** Wraps a tween class's own `dispatchEvent` so a throwing callback removes its tween instead of the game loop. */
function guardDispatch(
  proto: { dispatchEvent: Dispatch },
  tweenOf: (self: unknown) => Phaser.Tweens.BaseTween | null,
): void {
  const original = proto.dispatchEvent;
  proto.dispatchEvent = function (this: unknown, event: string, callback: string): void {
    try {
      original.call(this, event, callback);
    } catch (cause) {
      recordError(cause, `tween ${callback}`);
      try {
        tweenOf(this)?.remove();
      } catch {
        // Already torn down: nothing left to stop.
      }
    }
  };
}

let tweensGuarded = false;

/** Installs both nets. Call once, right after `new Phaser.Game(...)` — before boot binds the game's step. */
export function installFrameGuard(game: Phaser.Game): void {
  if (!tweensGuarded) {
    tweensGuarded = true;
    guardDispatch(
      Phaser.Tweens.TweenData.prototype as unknown as { dispatchEvent: Dispatch },
      (self) => (self as { tween?: Phaser.Tweens.BaseTween }).tween ?? null,
    );
    guardDispatch(
      Phaser.Tweens.BaseTween.prototype as unknown as { dispatchEvent: Dispatch },
      (self) => self as Phaser.Tweens.BaseTween,
    );
  }

  // `Game#start` binds `this.step` when the loop starts (after boot), so replacing it now is what the loop runs.
  const target = game as unknown as Record<"step" | "headlessStep", (time: number, delta: number) => void>;
  for (const key of ["step", "headlessStep"] as const) {
    const original = target[key].bind(game);
    target[key] = (time: number, delta: number): void => {
      try {
        original(time, delta);
      } catch (cause) {
        recordError(cause, "frame");
      }
    };
  }

  window.addEventListener("error", (event) => recordError(event.error ?? event.message, "window"));
  window.addEventListener("unhandledrejection", (event) => recordError(event.reason, "promise"));
}
