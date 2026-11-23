/**
 * The one call Title makes for the "Drawing without WebGL" notice: `maybeShowRendererNotice(this)` once Title is up.
 * It launches `scenes/renderer-notice.ts` over Title when the game fell back to Canvas by itself
 * (`platform/renderer-options.ts`) and the player has not closed the notice on this device. Kept free of the overlay's
 * code, so Title's chunk stays small.
 */
import type Phaser from "phaser";
import { canvasFallbackInUse } from "../platform/renderer-options.js";
import { rendererNoticeDue, rendererNoticeSeen } from "../view/webgl-help.js";
import { SCENES } from "./keys.js";

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** True when the notice is up (or already was this visit), so Title leaves its other one-time questions for later. */
export function maybeShowRendererNotice(scene: Phaser.Scene): boolean {
  if (scene.scene.manager.isActive(SCENES.rendererNotice)) return true;
  if (!rendererNoticeDue(canvasFallbackInUse(), rendererNoticeSeen(storage()))) return false;
  scene.scene.launch(SCENES.rendererNotice);
  return true;
}
