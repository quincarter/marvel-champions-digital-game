/**
 * Whether the device is in power saving mode, and what the game does about it.
 *
 * Android's Battery Saver (and a maker's own mode that sets the same flag, such as Samsung's Power saving) slows the
 * CPU and GPU, so the game's animation stutters. While it is on the game turns reduced motion on, draws text at 1x
 * and caps the frame rate (`POWER_SAVING_FPS`), unless the player has set those settings themselves
 * (`defaultSettings`), and says so on screen (`scenes/power-saving-notice.ts`, the Title footer, Settings). A player
 * who would rather play as usual turns Settings' "Lighter play in power saving" off (`Settings.powerSavingAdjust`):
 * the mode is still detected and shown, but nothing changes for it.
 *
 * Only the Android app can read the mode: the app's `PowerSaving` plugin (`android/.../PowerSavingPlugin.java`)
 * answers from the OS and pushes a `powerSaveModeChange` event when it flips, so nothing here polls. A browser has no
 * such signal (the Battery Status API reports charge, not the mode), so the web and the other shells never see it on.
 * `?powersave=1` forces it on anywhere, for a screenshot or a test, and `?powersave=0` forces it off.
 */
import { detectPlatform, type Platform } from "./platform.js";

/** The frame rate the game holds to while power saving: half a 60 Hz screen's, which roughly halves the GPU's work. */
export const POWER_SAVING_FPS = 30;

/** `detected`: the device is in power saving mode. `applied`: and the game is lightening itself for it. */
export interface PowerSavingState {
  readonly detected: boolean;
  readonly applied: boolean;
}

/** What changed: the device's mode, or the player's "Lighter play in power saving" setting. */
export type PowerSavingChange = "detected" | "ignored";

type Listener = (state: PowerSavingState, change: PowerSavingChange) => void;

let detected = false;
let ignored = false;
const listeners = new Set<Listener>();

export function powerSavingState(): PowerSavingState {
  return { detected, applied: detected && !ignored };
}

/** True while the game lightens itself: the device is in power saving mode and the player has not opted out. */
export function powerSavingOn(): boolean {
  return detected && !ignored;
}

/** Calls `listener` each time the mode or the player's opt-out changes; returns the unsubscribe. */
export function onPowerSavingChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(change: PowerSavingChange): void {
  const state = powerSavingState();
  for (const listener of [...listeners]) listener(state, change);
}

/** Records the device's mode, telling every listener when it changed. Exported for tests. */
export function setPowerSaving(on: boolean): void {
  if (on === detected) return;
  detected = on;
  notify("detected");
}

/** The player's opt-out (`Settings.powerSavingAdjust` off), set by the session at launch and on every change. */
export function setPowerSavingIgnored(on: boolean): void {
  if (on === ignored) return;
  ignored = on;
  notify("ignored");
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

/**
 * Whether this app build has the `PowerSaving` plugin: the native bridge lists its plugins (`Capacitor.PluginHeaders`)
 * before any page script runs. An older APK has none, and then `@capacitor/core` is not loaded at launch for it.
 */
export function hasPowerSavingPlugin(global: object = globalThis): boolean {
  const headers = (global as { Capacitor?: { PluginHeaders?: readonly { name?: string }[] } }).Capacitor?.PluginHeaders;
  return Array.isArray(headers) && headers.some((header) => header?.name === "PowerSaving");
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
  if (!canReadPowerSaving(platform, userAgent) || !hasPowerSavingPlugin()) return;
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
