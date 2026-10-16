/**
 * The desktop app's window mode and size (Settings > Display > Window). Tauri only: a browser tab and the phone apps
 * never offer or apply them.
 *
 * Tauri can't change the monitor's real resolution (it has no exclusive fullscreen), so the choices are:
 *  - Windowed: a normal window at the chosen size, centred, or the 1440 x 900 window `tauri.conf.json` opens at.
 *  - Borderless fullscreen: an undecorated window placed over the whole current monitor, at its own resolution.
 *  - Fullscreen: the OS's own fullscreen (its own Space on macOS; over the taskbar on Windows and Linux).
 * Sizes are in the monitor's own (physical) pixels, the numbers a player knows as a resolution. The list offers only
 * sizes smaller than the current monitor and no smaller than the window's minimum, so every choice fits.
 *
 * The pure half (which sizes to offer, what a saved size comes to) is tested; `applyDesktopWindow` only drives the
 * Tauri window API, and `src-tauri/capabilities/default.json` allows the setters it calls.
 */
import { windowSizePixelsOf, type DisplayMode, type WindowSize } from "../settings.js";
import { detectPlatform } from "./platform.js";

/** The window `tauri.conf.json` opens at, and its minimum, in logical pixels. */
export const DEFAULT_WINDOW_LOGICAL = { width: 1440, height: 900 } as const;
export const MIN_WINDOW_LOGICAL = { width: 960, height: 600 } as const;

/** The most sizes the Window size row offers besides Default, so its segments stay readable. */
const MAX_SIZE_OPTIONS = 5;

/** Common 16:9 and 16:10 resolutions, smallest first. */
export const WINDOW_SIZE_CANDIDATES: readonly WindowSize[] = [
  "1280x720",
  "1280x800",
  "1600x900",
  "1680x1050",
  "1920x1080",
  "1920x1200",
  "2560x1440",
  "2560x1600",
  "3200x1800",
  "3840x2160",
];

/** The monitor the window is on: its resolution in physical pixels and its scale factor (1.5 at 150%). */
export interface MonitorInfo {
  readonly width: number;
  readonly height: number;
  readonly scaleFactor: number;
}

/** Whether a physical size fits as a window on this monitor: smaller than the screen, no smaller than the minimum. */
function fitsWindowed(width: number, height: number, monitor: MonitorInfo): boolean {
  const scale = monitor.scaleFactor > 0 ? monitor.scaleFactor : 1;
  return (
    width < monitor.width &&
    height < monitor.height &&
    width / scale >= MIN_WINDOW_LOGICAL.width &&
    height / scale >= MIN_WINDOW_LOGICAL.height
  );
}

/**
 * The sizes to offer on this monitor, smallest first: the candidates that fit, those with the monitor's own shape
 * (16:9 or 16:10) when at least two of them fit, and at most the largest `MAX_SIZE_OPTIONS`.
 */
export function windowSizeOptionsFor(monitor: MonitorInfo): readonly WindowSize[] {
  const fitting = WINDOW_SIZE_CANDIDATES.filter((size) => {
    const px = windowSizePixelsOf(size)!;
    return fitsWindowed(px.width, px.height, monitor);
  });
  const aspect = monitor.width / monitor.height;
  const sameShape = fitting.filter((size) => {
    const px = windowSizePixelsOf(size)!;
    return Math.abs(px.width / px.height - aspect) < 0.02;
  });
  const offered = sameShape.length >= 2 ? sameShape : fitting;
  return offered.slice(-MAX_SIZE_OPTIONS);
}

/** The size a saved choice comes to on this monitor: itself when it is offered, otherwise "default". */
export function effectiveWindowSize(size: WindowSize, monitor: MonitorInfo | null): WindowSize {
  if (size === "default" || monitor === null) return size;
  return windowSizeOptionsFor(monitor).includes(size) ? size : "default";
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

/** Calls are chained so two quick changes (a click while the last one is still applying) land in order. */
let applying: Promise<void> = Promise.resolve();

/** Puts the window into `mode`, at `size` when windowed. Does nothing off desktop. */
export function applyDesktopWindow(mode: DisplayMode, size: WindowSize): Promise<void> {
  if (!hasDesktopWindow()) return Promise.resolve();
  applying = applying.then(() => applyNow(mode, size)).catch(() => {});
  return applying;
}

async function applyNow(mode: DisplayMode, size: WindowSize): Promise<void> {
  const { getCurrentWindow, currentMonitor, LogicalSize, PhysicalPosition, PhysicalSize } =
    await import("@tauri-apps/api/window");
  const window = getCurrentWindow();
  const current = await currentMonitor();
  if (current !== null) {
    monitor = { width: current.size.width, height: current.size.height, scaleFactor: current.scaleFactor };
  }
  if (mode === "fullscreen") {
    await window.setDecorations(true);
    await window.setFullscreen(true);
    return;
  }
  if (await window.isFullscreen()) await window.setFullscreen(false);
  if (await window.isMaximized()) await window.unmaximize();
  if (mode === "borderless") {
    await window.setDecorations(false);
    if (current !== null) {
      await window.setPosition(new PhysicalPosition(current.position.x, current.position.y));
      await window.setSize(new PhysicalSize(current.size.width, current.size.height));
    }
    return;
  }
  await window.setDecorations(true);
  const pixels = windowSizePixelsOf(effectiveWindowSize(size, monitor));
  await window.setSize(
    pixels === null
      ? new LogicalSize(DEFAULT_WINDOW_LOGICAL.width, DEFAULT_WINDOW_LOGICAL.height)
      : new PhysicalSize(pixels.width, pixels.height),
  );
  await window.center();
}

/** At launch: applies the saved choice, unless it is the window the app already opens as. */
export function applyDesktopWindowOnLaunch(settings: { displayMode: DisplayMode; windowSize: WindowSize }): void {
  if (settings.displayMode === "windowed" && settings.windowSize === "default") {
    void refreshDesktopMonitor();
    return;
  }
  void applyDesktopWindow(settings.displayMode, settings.windowSize);
}
