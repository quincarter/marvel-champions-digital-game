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

import { SCENES } from "../scenes/keys.js";
import { failedScreenText, recordError } from "./error-log.js";

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

const FAILED_SCREEN_PANEL_ID = "mc-screen-failure";
/** How long a screen may stay in its `create` after a frame threw before it is called failed. */
const FAILED_SCREEN_GRACE_MS = 400;

/**
 * A screen whose `create` threw is left half built and never runs, so the player sees an empty background with nothing
 * to press (the pack hero's "Play 1 hero" blank screen, 2026-11-11). The frame guard above keeps the loop alive; this
 * says what happened: when a frame threw and a scene is still stuck in its `create` a moment later, a plain panel with
 * the error and a way out goes over the canvas.
 */
function watchForFailedScreen(game: Phaser.Game, message: string): void {
  window.setTimeout(() => {
    if (document.getElementById(FAILED_SCREEN_PANEL_ID)) return;
    const stuck = game.scene.scenes.filter((scene) => scene.sys.settings.status === Phaser.Scenes.CREATING);
    if (stuck.length === 0) return;
    const panel = document.createElement("div");
    panel.id = FAILED_SCREEN_PANEL_ID;
    panel.setAttribute("role", "alert");
    panel.style.cssText =
      "position:fixed;inset:0;z-index:10;overflow:auto;padding:24px 16px;box-sizing:border-box;" +
      "background:#0e0c0a;color:#f3ead8;font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word";
    panel.textContent = failedScreenText(
      stuck.map((scene) => scene.sys.settings.key),
      message,
    );
    const button = (label: string, onClick: () => void): HTMLButtonElement => {
      const element = document.createElement("button");
      element.textContent = label;
      element.style.cssText = "display:block;margin-top:16px;padding:10px 20px;font:inherit";
      element.addEventListener("click", onClick);
      return element;
    };
    panel.append(
      button("Back to title", () => {
        panel.remove();
        for (const scene of stuck) game.scene.stop(scene.sys.settings.key);
        game.scene.start(SCENES.title);
      }),
      button("Reload", () => window.location.reload()),
    );
    document.body.append(panel);
  }, FAILED_SCREEN_GRACE_MS);
}

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
        watchForFailedScreen(game, cause instanceof Error ? cause.message : String(cause));
      }
    };
  }

  window.addEventListener("error", (event) => recordError(event.error ?? event.message, "window"));
  window.addEventListener("unhandledrejection", (event) => recordError(event.reason, "promise"));
}
