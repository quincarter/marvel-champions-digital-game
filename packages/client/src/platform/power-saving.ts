/**
 * Whether the device is in power saving mode, and what the game does about it.
 *
 * Android's Battery Saver (and a maker's own mode that sets the same flag, such as Samsung's Power saving) slows the
 * CPU and GPU, so the game's animation stutters. While it is on the game turns reduced motion on, draws text at 1x
 * and caps the frame rate (`POWER_SAVING_FPS`), unless the player has set those settings themselves
 * (`defaultSettings`), and says so on screen (`scenes/power-saving-notice.ts`, the Title footer, Settings).
 *
 * Only the Android app can read the mode: the app's `PowerSaving` plugin (`android/.../PowerSavingPlugin.java`)
 * answers from the OS and pushes a `powerSaveModeChange` event when it flips, so nothing here polls. A browser has no
 * such signal (the Battery Status API reports charge, not the mode), so the web and the other shells never see it on.
 * `?powersave=1` forces it on anywhere, for a screenshot or a test, and `?powersave=0` forces it off.
 */
import { detectPlatform, type Platform } from "./platform.js";

/** The frame rate the game holds to while power saving: half a 60 Hz screen's, which roughly halves the GPU's work. */
export const POWER_SAVING_FPS = 30;

type Listener = (on: boolean) => void;

let powerSaving = false;
const listeners = new Set<Listener>();

/** True while the device is in power saving mode (or `?powersave=1` says so). */
export function powerSavingOn(): boolean {
  return powerSaving;
}

/** Calls `listener` each time the mode changes; returns the unsubscribe. */
export function onPowerSavingChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Records the mode, telling every listener when it changed. Exported for tests. */
export function setPowerSaving(on: boolean): void {
  if (on === powerSaving) return;
  powerSaving = on;
  for (const listener of [...listeners]) listener(on);
}

/** `?powersave=1` or `?powersave=0` from a query string, or null when it says neither. */
export function forcedPowerSaving(search: string): boolean | null {
  const value = new URLSearchParams(search).get("powersave");
  if (value === "1" || value === "on") return true;
  if (value === "0" || value === "off") return false;
  return null;
}

/** Only the Android app can ask the OS. */
export function canReadPowerSaving(platform: Platform, userAgent: string): boolean {
  return platform === "capacitor" && /android/i.test(userAgent);
}

interface PowerSavingPlugin {
  isPowerSaveMode(): Promise<{ powerSaveMode: boolean }>;
  addListener(event: "powerSaveModeChange", listener: (state: { powerSaveMode: boolean }) => void): Promise<unknown>;
}

/**
 * Starts following the device's mode: once, at launch. The first answer arrives a moment after the game starts, so
 * the settings it changes take effect then (`appSession` refreshes its defaults on every change).
 */
export function watchPowerSaving(
  search: string = globalThis.location?.search ?? "",
  platform: Platform = detectPlatform(),
  userAgent: string = globalThis.navigator?.userAgent ?? "",
): void {
  const forced = forcedPowerSaving(search);
  if (forced !== null) {
    setPowerSaving(forced);
    return;
  }
  if (!canReadPowerSaving(platform, userAgent)) return;
  // Boxed, as `openExternal` does: the plugin proxy answers every property, `then` included.
  void import("@capacitor/core")
    .then(({ registerPlugin }) => ({ plugin: registerPlugin<PowerSavingPlugin>("PowerSaving") }))
    .then(async ({ plugin }) => {
      await plugin.addListener("powerSaveModeChange", (state) => setPowerSaving(state.powerSaveMode === true));
      const state = await plugin.isPowerSaveMode();
      setPowerSaving(state.powerSaveMode === true);
    })
    // An older app build without the plugin: the game simply never sees power saving.
    .catch(() => {});
}
