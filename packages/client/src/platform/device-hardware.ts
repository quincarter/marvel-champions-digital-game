/**
 * Reads the phone's hardware for the recommended screen settings (`platform/device-tier.ts`).
 *
 * At launch the game knows only what the page can see (`navigator.deviceMemory` and `hardwareConcurrency`) plus what
 * it learned on the last launch, kept in localStorage. Once the game's WebGL context names the GPU and the Android
 * app's `DeviceHardware` plugin answers (an older APK has none), the full reading is saved for next time and every
 * listener hears it, so the defaults settle on the first launch and are right from the first frame after that.
 *
 * The cache key has no `mc-` prefix on purpose: save-data export carries every `mc-*` entry, and one phone's hardware
 * must not travel to another.
 */
import type { HardwareInfo } from "./device-tier.js";
import { detectPlatform } from "./platform.js";

export const HARDWARE_CACHE_KEY = "device-hardware";

type Listener = (info: HardwareInfo) => void;
const listeners = new Set<Listener>();

function pageHardware(): HardwareInfo {
  const nav = globalThis.navigator as { deviceMemory?: number; hardwareConcurrency?: number } | undefined;
  return {
    ...(typeof nav?.deviceMemory === "number" ? { deviceMemoryGb: nav.deviceMemory } : {}),
    ...(typeof nav?.hardwareConcurrency === "number" ? { cores: nav.hardwareConcurrency } : {}),
  };
}

function cachedHardware(): HardwareInfo {
  try {
    const raw = globalThis.localStorage?.getItem(HARDWARE_CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as HardwareInfo) : {};
  } catch {
    return {};
  }
}

let known: HardwareInfo | null = null;

/** The best reading so far: the page's own, with the last full reading laid over it. */
export function knownHardware(): HardwareInfo {
  known ??= { ...pageHardware(), ...cachedHardware() };
  return known;
}

/** Calls `listener` when a fuller reading arrives; returns the unsubscribe. */
export function onHardwareChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether this app build has the `DeviceHardware` plugin, read as `hasPowerSavingPlugin` does. */
export function hasDeviceHardwarePlugin(global: object = globalThis): boolean {
  const headers = (global as { Capacitor?: { PluginHeaders?: readonly { name?: string }[] } }).Capacitor?.PluginHeaders;
  return Array.isArray(headers) && headers.some((header) => header?.name === "DeviceHardware");
}

interface DeviceHardwarePlugin {
  getHardware(): Promise<HardwareInfo>;
}

async function appHardware(): Promise<HardwareInfo> {
  if (detectPlatform() !== "capacitor" || !hasDeviceHardwarePlugin()) return {};
  try {
    const { registerPlugin } = await import("@capacitor/core");
    // Boxed, as `watchPowerSaving` does: the plugin proxy answers every property, `then` included.
    const boxed = { plugin: registerPlugin<DeviceHardwarePlugin>("DeviceHardware") };
    return await boxed.plugin.getHardware();
  } catch {
    return {};
  }
}

/**
 * Completes the reading once: `gpu` is the game's own WebGL renderer name. Saves it and tells every listener when it
 * differs from what the game started with.
 */
export async function readHardware(gpu: string | null): Promise<HardwareInfo> {
  const app = await appHardware();
  const next: HardwareInfo = { ...pageHardware(), ...app, ...(gpu ? { gpu } : {}) };
  const before = JSON.stringify(knownHardware());
  known = { ...knownHardware(), ...next };
  if (JSON.stringify(known) !== before) {
    try {
      globalThis.localStorage?.setItem(HARDWARE_CACHE_KEY, JSON.stringify(known));
    } catch {
      // Private mode or a full quota: it is read again next launch.
    }
    for (const listener of [...listeners]) listener(known);
  }
  return known;
}
