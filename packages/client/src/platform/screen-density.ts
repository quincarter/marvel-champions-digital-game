/**
 * Whether and how densely the game draws past one pixel per CSS pixel (`platform/screen-settings.ts` applies it). Pure,
 * so the choices are tested without a game.
 */
import { renderScaleFactorOf, type Settings } from "../settings.js";
import { detectPlatform, type Platform } from "./platform.js";

/** Text past 3x costs texture memory (it grows with the square) for a difference nobody can see on a phone. */
export const MAX_TEXT_RESOLUTION = 3;

/**
 * From a query string: `?renderscale=2` or `?renderscale=native` forces that scale; `?renderscale=on` draws as the
 * Android app does, following the Resolution setting (a browser test of the Screen section). Null without one.
 */
export function forcedRenderScale(search: string): number | "native" | "on" | null {
  const value = new URLSearchParams(search).get("renderscale");
  if (value === null) return null;
  if (value === "native" || value === "on") return value;
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? number : null;
}

/** Only the Android app draws at the screen's density by default. */
export function drawsAtScreenDensity(platform: Platform, userAgent: string, search = ""): boolean {
  return forcedRenderScale(search) !== null || (platform === "capacitor" && /android/i.test(userAgent));
}

/** True on a device that reports 2 GB of memory or less. Chromium only (the Android WebView reports it). */
export function isLowMemoryDevice(
  nav: { readonly deviceMemory?: number } | undefined = globalThis.navigator as { readonly deviceMemory?: number },
): boolean {
  const memory = nav?.deviceMemory;
  return typeof memory === "number" && memory > 0 && memory <= 2;
}

export interface ScreenEnvironment {
  readonly platform: Platform;
  readonly userAgent: string;
  readonly search: string;
  readonly devicePixelRatio: number;
}

export function screenEnvironment(): ScreenEnvironment {
  return {
    platform: detectPlatform(),
    userAgent: globalThis.navigator?.userAgent ?? "",
    search: globalThis.location?.search ?? "",
    devicePixelRatio: globalThis.devicePixelRatio || 1,
  };
}

/** The device pixels per CSS pixel the game draws at under `settings` here: 1 wherever screen density is off. */
export function renderScaleFor(
  settings: Pick<Settings, "renderScale">,
  env: ScreenEnvironment = screenEnvironment(),
): number {
  if (!drawsAtScreenDensity(env.platform, env.userAgent, env.search)) return 1;
  const forced = forcedRenderScale(env.search);
  if (forced === "native") return renderScaleFactorOf("native", env.devicePixelRatio);
  if (typeof forced === "number") return forced;
  return renderScaleFactorOf(settings.renderScale, env.devicePixelRatio);
}

/**
 * The resolution new text draws at. Where the game draws at the screen's density, sharp text follows the buffer (up to
 * `MAX_TEXT_RESOLUTION`): text at 2x in a 3x buffer was the one soft thing left on screen. Elsewhere it is the setting.
 */
export function textResolutionFor(
  settings: Pick<Settings, "textResolution">,
  renderScale: number,
  densityOn: boolean,
): number {
  if (!densityOn || settings.textResolution <= 1) return settings.textResolution;
  return Math.max(settings.textResolution, Math.min(MAX_TEXT_RESOLUTION, renderScale));
}
