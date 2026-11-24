/**
 * How to turn WebGL back on, for the browser the player is in.
 *
 * A browser with WebGL switched off (a Discord report: Firefox 157 on Windows, "Cannot create WebGL context, aborting.",
 * while Opera on the same PC was fine) now plays on Phaser's Canvas renderer instead (`main.ts`,
 * `platform/renderer-options.ts`). Canvas draws on the CPU at 1x, so the game says once why it may run slower and look
 * softer, with these steps (`scenes/renderer-notice.ts`); the startup failure panel lists them too, for the rare
 * browser where Canvas fails as well (`ui/startup-watchdog.ts`).
 *
 * The usual causes in Firefox are hardware acceleration being off, `webgl.disabled` set in about:config, a graphics
 * driver on Firefox's blocklist (about:support > Graphics shows it), or a hardened fork that ships with WebGL off.
 * Chromium browsers turn WebGL off with graphics acceleration, and their GPU page names the reason.
 */
import { t, type MessageKey } from "../i18n/translate.js";

export type BrowserFamily = "firefox" | "chrome" | "edge" | "opera" | "safari" | "other";

/** The browser family by its user agent. Every browser on iOS is Safari underneath, so it gets Safari's steps. */
export function browserFamilyOf(userAgent: string): BrowserFamily {
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) return "safari";
  // Firefox on Android has none of the desktop settings the Firefox steps name.
  if (/\bFirefox\//.test(userAgent)) return /\bAndroid\b/.test(userAgent) ? "other" : "firefox";
  if (/\bOPR\//.test(userAgent)) return "opera";
  if (/\bEdg\//.test(userAgent)) return "edge";
  if (/\b(Chrome|Chromium)\//.test(userAgent)) return "chrome";
  if (/\bSafari\//.test(userAgent) && /\bVersion\//.test(userAgent)) return "safari";
  return "other";
}

/** The Chromium browsers' GPU page, which says whether WebGL is on and why not. */
const GPU_PAGE: Readonly<Record<"chrome" | "edge" | "opera", string>> = {
  chrome: "chrome://gpu",
  edge: "edge://gpu",
  opera: "opera://gpu",
};

const STEPS: Readonly<Record<"firefox" | "chromium" | "safari" | "other", readonly MessageKey[]>> = {
  firefox: ["webglHelp.firefox.acceleration", "webglHelp.firefox.disabled", "webglHelp.firefox.blocklist"],
  chromium: ["webglHelp.chromium.acceleration", "webglHelp.chromium.gpuPage", "webglHelp.driver"],
  safari: ["webglHelp.safari.update", "webglHelp.otherBrowser"],
  other: ["webglHelp.other.acceleration", "webglHelp.driver", "webglHelp.otherBrowser"],
};

/** The steps, in order, in the player's language. */
export function webglHelpSteps(userAgent: string): readonly string[] {
  const family = browserFamilyOf(userAgent);
  if (family === "chrome" || family === "edge" || family === "opera") {
    return STEPS.chromium.map((key) => t(key, { gpuPage: GPU_PAGE[family] }));
  }
  return STEPS[family].map((key) => t(key));
}

/** The steps as numbered lines, for a text block. */
export function webglHelpText(userAgent: string): string {
  return webglHelpSteps(userAgent)
    .map((step, i) => `${i + 1}. ${step}`)
    .join("\n");
}

/** Remembered once the player has closed the notice, so it is shown once on a device. */
export const RENDERER_NOTICE_SEEN_KEY = "mc-canvas-fallback-seen";

export function rendererNoticeSeen(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    return storage?.getItem(RENDERER_NOTICE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markRendererNoticeSeen(storage: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(RENDERER_NOTICE_SEEN_KEY, "1");
  } catch {
    // Private mode or full storage: the notice comes again next launch, which is harmless.
  }
}

/** The notice is due when the game fell back to Canvas by itself and the player has not closed it on this device. */
export function rendererNoticeDue(canvasFallback: boolean, seen: boolean): boolean {
  return canvasFallback && !seen;
}
