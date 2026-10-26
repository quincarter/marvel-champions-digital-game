/**
 * Keeps a scene's glyphs current: subscribes to the input-device store, hands the scene a snapshot on every change,
 * and drives the expand/collapse openness while the mouse moves. A scene adopts it in a few lines:
 *
 *   bindInputHints(this, ({ state, settings, openness }) => {
 *     const specs = glyphsForShortcut("activate", state, settings);
 *     if (specs) glyph.setSpecs(specs).setOpenness(openness);
 *     glyph.setVisible(specs !== null);
 *   });
 *
 * Unsubscribes on the scene's SHUTDOWN. Settings have no change event, so they are read at each notification; call
 * `hints.refresh()` after a setting changes in the same scene.
 */

import Phaser from "phaser";
import { inputDevice, onInputDeviceChange } from "../platform/input-device.js";
import { appSession } from "../session.js";
import type { Settings } from "../settings.js";
import { OpennessAnimator } from "../view/input-glyph-model.js";
import { glyphsExpanded, type InputModeState } from "../view/input-mode.js";

export interface InputHintsSnapshot {
  readonly state: InputModeState;
  readonly settings: Settings;
  /** 0 (tab) to 1 (full), animated; exactly 0 or 1 under reduced motion. */
  readonly openness: number;
}

export interface InputHints {
  /** Re-delivers the snapshot now (after a setting changed). */
  refresh(): void;
  dispose(): void;
}

const settingsListeners = new Set<() => void>();

/**
 * Tells every bound scene a setting that changes the hints (their size, whether they show) was just set, so each
 * redelivers its snapshot: the Controls screen over the board calls it, and the board's glyphs resize behind it.
 */
export function notifyHintSettingsChanged(): void {
  for (const listener of [...settingsListeners]) listener();
}

export function bindInputHints(scene: Phaser.Scene, apply: (snapshot: InputHintsSnapshot) => void): InputHints {
  const animator = new OpennessAnimator();
  let disposed = false;
  const deliver = (): void => {
    if (disposed) return;
    const settings = appSession().settings;
    const now = scene.time.now;
    const state = inputDevice();
    animator.retarget(glyphsExpanded(state), now, settings.reducedMotion);
    apply({ state, settings, openness: animator.value(now, settings.reducedMotion) });
  };
  const tick = (): void => {
    if (!disposed && animator.animating(scene.time.now, appSession().settings.reducedMotion)) deliver();
  };
  const offInput = onInputDeviceChange(deliver);
  settingsListeners.add(deliver);
  const off = (): void => {
    offInput();
    settingsListeners.delete(deliver);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    off();
    scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, dispose);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
  deliver();
  return { refresh: deliver, dispose };
}
