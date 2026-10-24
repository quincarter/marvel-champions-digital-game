/**
 * Whether and how densely the game draws past one pixel per CSS pixel (`platform/screen-settings.ts` applies it). Pure,
 * so the choices are tested without a game.
 */
import { couchModeFactor, renderScaleFactorOf, type Settings } from "../settings.js";
import { detectPlatform, type Platform } from "./platform.js";

/** Text past 3x costs texture memory (it grows with the square) for a difference nobody can see on a phone. */
export const MAX_TEXT_RESOLUTION = 3;

/**
 * From a query string: `?renderscale=2` or `?renderscale=native` forces that scale; `?renderscale=off` draws at 1x as
 * every build did before #320 (to compare, or to rule the layer out of a bug); `?renderscale=on` is the default, the
 * Render resolution setting. Null without one.
 */
export function forcedRenderScale(search: string): number | "native" | "on" | "off" | null {
  const value = new URLSearchParams(search).get("renderscale");
  if (value === null) return null;
  if (value === "native" || value === "on" || value === "off") return value;
  const number = Number(value);
  return Number.isFinite(number) && number >= 1 ? number : null;
}

/**
 * Every build draws at the screen's density (#320): the Android app, iOS, the web and the desktop app, where Windows
 * display scaling, a 4K monitor or a Retina screen all left a 1x picture stretched. `?renderscale=off` turns it off.
 */
export function drawsAtScreenDensity(search = ""): boolean {
  return forcedRenderScale(search) !== "off";
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
  settings: Pick<Settings, "renderScale"> & { readonly couchMode?: Settings["couchMode"] },
  env: ScreenEnvironment = screenEnvironment(),
): number {
  // Couch mode lays the game out smaller and scales it up (`ui/render-resolution.ts`), so the buffer needs that many
  // more pixels per game pixel to stay as sharp as the screen.
  const couch = couchModeFactor(settings.couchMode ?? "off");
  if (!drawsAtScreenDensity(env.search)) return couch;
  const forced = forcedRenderScale(env.search);
  if (forced === "native") return renderScaleFactorOf("native", env.devicePixelRatio) * couch;
  if (typeof forced === "number") return forced * couch;
  return renderScaleFactorOf(settings.renderScale, env.devicePixelRatio) * couch;
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
