/**
 * The one call Title makes for the "Drawing without WebGL" notice: `maybeShowRendererNotice(this)` once Title is up.
 * It launches `scenes/renderer-notice.ts` over Title when the game fell back to Canvas by itself
 * (`platform/renderer-options.ts`) and the player has not closed the notice on this device. Kept free of the overlay's
 * code, so Title's chunk stays small.
 *
 * The overlay loads on demand (`scenes/scene-loader.ts`, outside its queue of deferred calls), so it is not up at once. Until it is, Title
 * takes no pointer input and `rendererNoticePending()` holds its keys and pad (`conflictPromptOwnsInput`), so nothing
 * on Title is pressed in between and the notice can never come up over the screen a press opened instead.
 */
import type Phaser from "phaser";
import { canvasFallbackInUse } from "../platform/renderer-options.js";
import { rendererNoticeDue, rendererNoticeSeen } from "../view/webgl-help.js";
import { SCENES } from "./keys.js";
import { sceneLoader } from "./scene-loader.js";

/** How often the launch checks whether the overlay is up, and how long it waits before giving Title back anyway. */
const CHECK_MS = 50;
const GIVE_UP_MS = 15_000;

let pending = false;
/** False once a launch has been given up (timed out, or Title left first): the overlay stops itself if it still starts. */
let wanted = false;

/** Read by the overlay as it starts: a late start, after the launch was given up, closes at once. */
export function rendererNoticeWanted(): boolean {
  return wanted;
}

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
  wanted = true;
  scene.input.enabled = false;
  const release = (): void => {
    pending = false;
    // Never up in time: a start that comes later would land over whatever screen is up by then.
    if (!manager.isActive(SCENES.rendererNotice)) wanted = false;
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
    timer.remove(false);
    if (!pending && manager.isActive(SCENES.rendererNotice)) return;
    pending = false;
    wanted = false;
    manager.stop(SCENES.rendererNotice);
  });
  // The overlay's code is loaded here, outside the scene loader's queue of deferred calls: a load that hangs on a bad
  // network must never hold up the screens the player opens once Title is given back. It is launched only once it is
  // registered (so the launch runs at once), and only while the launch is still wanted and Title is still up.
  const loaded = sceneLoader()?.load(SCENES.rendererNotice) ?? Promise.resolve();
  void loaded.then(
    () => {
      if (wanted && pending && scene.sys.isActive()) scene.scene.launch(SCENES.rendererNotice);
    },
    () => {
      if (pending) release();
    },
  );
  return true;
}
