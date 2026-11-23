/**
 * The one call Title makes for the "Drawing without WebGL" notice: `maybeShowRendererNotice(this)` once Title is up.
 * It launches `scenes/renderer-notice.ts` over Title when the game fell back to Canvas by itself
 * (`platform/renderer-options.ts`) and the player has not closed the notice on this device. Kept free of the overlay's
 * code, so Title's chunk stays small.
 *
 * The overlay loads on demand (`scenes/scene-loader.ts`), so it is not up the moment it is launched. Until it is, Title
 * takes no pointer input and `rendererNoticePending()` holds its keys and pad (`conflictPromptOwnsInput`), so nothing
 * on Title is pressed in between and the notice can never come up over the screen a press opened instead.
 */
import type Phaser from "phaser";
import { canvasFallbackInUse } from "../platform/renderer-options.js";
import { rendererNoticeDue, rendererNoticeSeen } from "../view/webgl-help.js";
import { SCENES } from "./keys.js";

/** How often the launch checks whether the overlay is up, and how long it waits before giving Title back anyway. */
const CHECK_MS = 50;
const GIVE_UP_MS = 15_000;

let pending = false;

/** True between the launch and the overlay coming up: Title's keys and pad are held. */
export function rendererNoticePending(): boolean {
  return pending;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** True when the notice is up (or on its way), so Title leaves its other one-time questions for later. */
export function maybeShowRendererNotice(scene: Phaser.Scene): boolean {
  const manager = scene.scene.manager;
  if (pending || manager.isActive(SCENES.rendererNotice)) return true;
  if (!rendererNoticeDue(canvasFallbackInUse(), rendererNoticeSeen(storage()))) return false;
  pending = true;
  scene.input.enabled = false;
  const release = (): void => {
    pending = false;
    timer.remove(false);
    if (scene.sys.isActive()) scene.input.enabled = true;
  };
  const started = scene.time.now;
  const timer = scene.time.addEvent({
    delay: CHECK_MS,
    loop: true,
    callback: () => {
      // Up: its full-screen zone takes Title's pointer from here, and the input check holds Title's keys.
      if (manager.isActive(SCENES.rendererNotice)) release();
      else if (scene.time.now - started > GIVE_UP_MS) release();
    },
  });
  // Title going away (a link's screen, say) ends the wait; a notice still on its way is stopped as it starts.
  scene.events.once("shutdown", () => {
    if (!pending) return;
    pending = false;
    timer.remove(false);
    manager.stop(SCENES.rendererNotice);
  });
  scene.scene.launch(SCENES.rendererNotice);
  return true;
}
