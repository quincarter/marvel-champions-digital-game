/**
 * The desktop app's window mode and resolution (Settings > Display > Window). Tauri only: a browser tab and the phone
 * apps never offer or apply them.
 *
 * The OS's own display resolution is never changed, so closing the game (or a crash) leaves nothing to put back. A
 * resolution is what the game draws at instead, in the monitor's own (physical) pixels, the numbers a player knows:
 *  - Borderless fullscreen: the shell's own borderless fullscreen over the current monitor (taskbar too). Native draws at the monitor's own
 *    resolution; any other draws at that size and is scaled to fit the screen (up from a lower one, down from a
 *    higher one), with black bars where the shapes differ (`renderSizeOf`; `ui/render-resolution.ts` does the drawing).
 *  - Fullscreen: the OS's own fullscreen, resolution as in Borderless. On macOS it gets its own Space; on Windows and
 *    Linux the shell has only the one (borderless) fullscreen, so it matches Borderless there. Switching the monitor's
 *    real display mode (exclusive fullscreen) is not something Tauri offers.
 *  - Windowed: a normal window. A resolution is the window's own size, centred; Native is a window drawn 1:1 at
 *    whatever size it is, opening at the 1440 x 900 `tauri.conf.json` gives it.
 * The list offers resolutions from 480p up to 4K, none under the window's minimum, and in Windowed none larger than
 * the current monitor.
 *
 * The pure half (which sizes to offer, what a saved one comes to, what the game draws at) is tested;
 * `applyDesktopWindow` only drives the Tauri window API, and `src-tauri/capabilities/default.json` allows the setters
 * it calls.
 */
import { resolutionPixelsOf, type DisplayMode, type Resolution } from "../settings.js";
import { detectPlatform } from "./platform.js";

/** The window `tauri.conf.json` opens at, and its minimum, in logical pixels. */
export const DEFAULT_WINDOW_LOGICAL = { width: 1440, height: 900 } as const;
export const MIN_WINDOW_LOGICAL = { width: 640, height: 360 } as const;

/** Common resolutions (4:3, 5:4, 16:9, 16:10, 21:9), smallest first. */
export const RESOLUTION_CANDIDATES: readonly Resolution[] = [
  "854x480",
  "800x600",
  "1024x768",
  "1280x720",
  "1280x800",
  "1366x768",
  "1280x1024",
  "1440x900",
  "1600x900",
  "1680x1050",
  "1920x1080",
  "1920x1200",
  "2560x1080",
  "2560x1440",
  "2560x1600",
  "3440x1440",
  "3840x2160",
];

/** The monitor the window is on: its resolution in physical pixels and its scale factor (1.5 at 150%). */
export interface MonitorInfo {
  readonly width: number;
  readonly height: number;
  readonly scaleFactor: number;
}

/**
 * Whether a physical size is worth offering on this monitor in `mode`: not the screen's own size (that is Native), no
 * smaller than the window's minimum, and in Windowed no larger than the screen. Borderless and Fullscreen also offer
 * resolutions above native, drawn at that size and scaled down to fit.
 */
function offeredOn(width: number, height: number, monitor: MonitorInfo, mode: DisplayMode): boolean {
  const scale = monitor.scaleFactor > 0 ? monitor.scaleFactor : 1;
  if (width === monitor.width && height === monitor.height) return false;
  if (width / scale < MIN_WINDOW_LOGICAL.width || height / scale < MIN_WINDOW_LOGICAL.height) return false;
  return mode !== "windowed" || (width <= monitor.width && height <= monitor.height);
}

/** The resolutions to offer on this monitor besides Native, smallest first. */
export function resolutionOptionsFor(monitor: MonitorInfo, mode: DisplayMode = "windowed"): readonly Resolution[] {
  return RESOLUTION_CANDIDATES.filter((size) => {
    const px = resolutionPixelsOf(size)!;
    return offeredOn(px.width, px.height, monitor, mode);
  });
}

/** The resolution a saved choice comes to on this monitor in `mode`: itself when it is offered, otherwise "native". */
export function effectiveResolution(
  size: Resolution,
  monitor: MonitorInfo | null,
  mode: DisplayMode = "windowed",
): Resolution {
  if (size === "native" || monitor === null) return size;
  return resolutionOptionsFor(monitor, mode).includes(size) ? size : "native";
}

/**
 * The size the game draws at, in CSS pixels, when it is scaled to fit the screen: a fullscreen mode at a resolution
 * other than native. The bars then follow the shapes: a 4:3 resolution on a 21:9 screen gets them left and right, a
 * 21:9 one on a 16:9 screen top and bottom. Null means the game fills its window 1:1 (Windowed, Native, or no monitor read yet).
 */
export function renderSizeOf(
  mode: DisplayMode,
  resolution: Resolution,
  monitor: MonitorInfo | null,
): { readonly width: number; readonly height: number } | null {
  if (mode === "windowed" || monitor === null) return null;
  const px = resolutionPixelsOf(effectiveResolution(resolution, monitor, mode));
  if (px === null) return null;
  const scale = monitor.scaleFactor > 0 ? monitor.scaleFactor : 1;
  return { width: Math.round(px.width / scale), height: Math.round(px.height / scale) };
}

/** What draws the game at a fixed size scaled to fill the window, or back at the window's own size (null). */
export type RenderSizeHandler = (size: { readonly width: number; readonly height: number } | null) => void;

let renderSizeHandler: RenderSizeHandler | null = null;

/** `main.ts` registers the Phaser side (`ui/render-resolution.ts`) once the game exists. */
export function setRenderSizeHandler(handler: RenderSizeHandler): void {
  renderSizeHandler = handler;
}

/** True when this build can change its own window: the desktop app. */
export function hasDesktopWindow(): boolean {
  return detectPlatform() === "tauri";
}

let monitor: MonitorInfo | null = null;

/** The current monitor as last read (`refreshDesktopMonitor`), or null before the first read and off desktop. */
export function desktopMonitor(): MonitorInfo | null {
  return monitor;
}

/** Reads the monitor the window is on now. Resolves null off desktop or when the shell can't say. */
export async function refreshDesktopMonitor(): Promise<MonitorInfo | null> {
  if (!hasDesktopWindow()) return null;
  try {
    const { currentMonitor } = await import("@tauri-apps/api/window");
    const current = await currentMonitor();
    monitor =
      current === null
        ? null
        : { width: current.size.width, height: current.size.height, scaleFactor: current.scaleFactor };
  } catch {
    // Leave the last reading in place.
  }
  return monitor;
}

const isMac = (): boolean => /Mac/.test(globalThis.navigator?.platform ?? globalThis.navigator?.userAgent ?? "");

/** Calls are chained so two quick changes (a click while the last one is still applying) land in order. */
let applying: Promise<void> = Promise.resolve();

/** Puts the window into `mode` and draws the game at `size`. Does nothing off desktop. */
export function applyDesktopWindow(mode: DisplayMode, size: Resolution): Promise<void> {
  if (!hasDesktopWindow()) return Promise.resolve();
  applying = applying
    .then(() => applyNow(mode, size))
    .catch(() => {})
    .then(() => renderSizeHandler?.(renderSizeOf(mode, size, monitor)));
  return applying;
}

async function applyNow(mode: DisplayMode, size: Resolution): Promise<void> {
  const { getCurrentWindow, currentMonitor, LogicalSize, PhysicalSize } = await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  const current = await currentMonitor();
  if (current !== null) {
    monitor = { width: current.size.width, height: current.size.height, scaleFactor: current.scaleFactor };
  }
  // Borderless is the shell's own borderless fullscreen: on Windows and Linux that is `setFullscreen` itself (a
  // window over the whole monitor, taskbar included, that Alt+Tab leaves at once), on macOS a full-screen window
  // without its own Space. A window merely sized to the screen left the Windows taskbar showing over it.
  if (mode === "borderless") {
    if (isMac()) {
      if (await window.isFullscreen()) await window.setFullscreen(false);
      await window.setSimpleFullscreen(true);
    } else {
      await window.setFullscreen(true);
    }
    await window.setFocus();
    return;
  }
  if (isMac()) await window.setSimpleFullscreen(false);
  if (mode === "fullscreen") {
    await window.setFullscreen(true);
    await window.setFocus();
    return;
  }
  if (await window.isFullscreen()) await window.setFullscreen(false);
  if (await window.isMaximized()) await window.unmaximize();
  await window.setDecorations(true);
  const pixels = resolutionPixelsOf(effectiveResolution(size, monitor));
  await window.setSize(
    pixels === null
      ? new LogicalSize(DEFAULT_WINDOW_LOGICAL.width, DEFAULT_WINDOW_LOGICAL.height)
      : new PhysicalSize(pixels.width, pixels.height),
  );
  await window.center();
}

/** At launch: applies the saved choice, unless it is the window the app already opens as. */
export function applyDesktopWindowOnLaunch(settings: { displayMode: DisplayMode; resolution: Resolution }): void {
  if (settings.displayMode === "windowed" && settings.resolution === "native") {
    void refreshDesktopMonitor();
    return;
  }
  void applyDesktopWindow(settings.displayMode, settings.resolution);
}

/** Closes the desktop app's one window, which ends the app. Does nothing off desktop. */
export async function quitToDesktop(): Promise<void> {
  if (!hasDesktopWindow()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}
