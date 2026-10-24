/**
 * The screen settings (Settings > Display > Screen): the resolution the game draws at, and its frame rate. `applyScreenSettings` puts the session's settings into effect, at launch, on every change in Settings, and
 * when power saving mode moves the defaults.
 *
 * Resolution: the game lays out in CSS pixels, and until now drew one pixel per CSS pixel, so a 3x phone showed a
 * 360-pixel-wide picture stretched to 1080 (a player's report: "Platform: capacitor (phone, 360x788)"). The same
 * held on desktop and the web under display scaling (Windows at 150%, a Retina screen). Every build now draws at the
 * screen's own density by default (`ui/render-scale.ts`), with lighter choices below it; `?renderscale=off` draws at
 * 1x as before, and `?renderscale=<n>|native` forces a scale, for a test or a screenshot.
 *
 * Frame rate: the game loop runs on `requestAnimationFrame`, which follows the screen's refresh rate, so "Match screen"
 * is no cap and 60 or 30 are Phaser's own fps limit. On Android the `DisplayRate` plugin also asks the OS for the
 * matching refresh rate: the fastest mode for "Match screen" (a 120 Hz phone otherwise may run the app at 60), and the
 * slowest mode that covers a cap, so the panel slows down with the game.
 */
import type Phaser from "phaser";
import { couchModeFactor, fpsLimitOf, type FrameRate, type Settings } from "../settings.js";
import { applyCouchMode } from "../ui/render-resolution.js";
import { setTextResolution } from "../ui/theme.js";
import { currentRenderScale, setRenderScale } from "../ui/render-scale.js";
import { drawsAtScreenDensity, renderScaleFor, screenEnvironment, textResolutionFor } from "./screen-density.js";
import { appSession } from "../session.js";
import { knownHardware } from "./device-hardware.js";
import { deviceTierOf, hardwareSummaryOf, tierLabelOf } from "./device-tier.js";

/** The screen's refresh rates as the Android app reports them; null until read, or off Android. */
export interface RefreshInfo {
  readonly refreshRate: number;
  readonly maxRefreshRate: number;
}

let refresh: RefreshInfo | null = null;

/** The screen's refresh rates, once the app has answered (`readRefreshInfo`). */
export function knownRefreshInfo(): RefreshInfo | null {
  return refresh;
}

interface DisplayRatePlugin {
  getInfo(): Promise<RefreshInfo>;
  setFrameRate(options: { fps: number }): Promise<void>;
}

/** Whether this app build has the `DisplayRate` plugin (an older APK has not), as `hasPowerSavingPlugin` reads it. */
export function hasDisplayRatePlugin(global: object = globalThis): boolean {
  const headers = (global as { Capacitor?: { PluginHeaders?: readonly { name?: string }[] } }).Capacitor?.PluginHeaders;
  return Array.isArray(headers) && headers.some((header) => header?.name === "DisplayRate");
}

let plugin: Promise<{ plugin: DisplayRatePlugin } | null> | null = null;

function displayRate(): Promise<{ plugin: DisplayRatePlugin } | null> {
  if (plugin !== null) return plugin;
  const env = screenEnvironment();
  if (env.platform !== "capacitor" || !/android/i.test(env.userAgent) || !hasDisplayRatePlugin()) {
    plugin = Promise.resolve(null);
    return plugin;
  }
  // Boxed, as `watchPowerSaving` does: the plugin proxy answers every property, `then` included.
  plugin = import("@capacitor/core")
    .then(({ registerPlugin }) => ({ plugin: registerPlugin<DisplayRatePlugin>("DisplayRate") }))
    .catch(() => null);
  return plugin;
}

/** Reads the screen's refresh rates from the Android app; resolves null anywhere else. */
export async function readRefreshInfo(): Promise<RefreshInfo | null> {
  const boxed = await displayRate();
  if (boxed === null) return null;
  try {
    refresh = await boxed.plugin.getInfo();
  } catch {
    // An app build that cannot say: the Frame rate row simply names no rate.
  }
  return refresh;
}

let requestedFps: number | null = null;

function requestRefreshRate(rate: FrameRate): void {
  const fps = fpsLimitOf(rate);
  if (fps === requestedFps) return;
  requestedFps = fps;
  void displayRate().then((boxed) => boxed?.plugin.setFrameRate({ fps }).catch(() => {}));
}

/** Puts the screen settings into effect on a running game: the render scale, sharp text to match, and the frame rate. */
export function applyScreenSettings(game: Phaser.Game, settings: Settings): void {
  const env = screenEnvironment();
  const densityOn = drawsAtScreenDensity(env.search);
  // Couch mode first: the render scale below counts the layout size it sets.
  applyCouchMode(game, couchModeFactor(settings.couchMode));
  const scale = renderScaleFor(settings, env);
  if (scale !== currentRenderScale()) setRenderScale(scale);
  setTextResolution(textResolutionFor(settings, currentRenderScale(), densityOn));
  game.loop.setFPSLimit(fpsLimitOf(settings.frameRate));
  requestRefreshRate(settings.frameRate);
}

/**
 * The issue report's "Display" line where the game draws past 1x: the buffer it draws, the choices in effect, and the
 * hardware check behind them. Empty elsewhere, so the report reads as it always did there.
 */
export function displayLineOf(width: number, height: number): { readonly display?: string } {
  const env = screenEnvironment();
  if (!drawsAtScreenDensity(env.search)) return {};
  const scale = currentRenderScale();
  const { renderScale, frameRate } = appSession().settings;
  const hardware = knownHardware();
  const tier = tierLabelOf(deviceTierOf(hardware));
  const summary = hardwareSummaryOf(hardware);
  const refresh = knownRefreshInfo();
  return {
    display:
      `${Math.round(width * scale)}x${Math.round(height * scale)} at ${scale}x (devicePixelRatio ${env.devicePixelRatio}), ` +
      `resolution ${renderScale}, frame rate ${frameRate}${refresh ? ` (screen up to ${refresh.maxRefreshRate} Hz)` : ""} · ` +
      `${tier}${summary ? ` (${summary})` : ""}`,
  };
}
