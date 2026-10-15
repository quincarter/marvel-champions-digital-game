/**
 * A plain-text explanation when the game cannot draw at all (issue #157).
 *
 * Phaser draws every screen, the boot "Loading" line included, so when WebGL fails on a device the player gets a
 * black page and a report has nothing in it: on a phone in Edge both production and the previews loaded to pure
 * black. This watches the start of the game and, when it has evidence the canvas will never draw, puts one DOM panel
 * over it (the page's only other DOM is `McTextInput`) naming what went wrong and the device's WebGL details, so a
 * screenshot from the phone says why. Evidence is any of:
 *  - an uncaught error or rejection before the first screen after Boot (Phaser's own "WebGL unsupported" included);
 *  - the WebGL context lost and not restored within `RESTORE_GRACE_MS`;
 *  - no frame rendered at all `FIRST_FRAME_MS` after the page started.
 *
 * It reads and reports; it never changes the game. Errors also go to `recordError`, so Ctrl+Shift+D carries them.
 */
import type Phaser from "phaser";
import { SCENES } from "../scenes/keys.js";
import { recordError } from "./error-log.js";

const FIRST_FRAME_MS = 20_000;
const RESTORE_GRACE_MS = 3_000;
const PANEL_ID = "mc-startup-failure";
const BOOT_SCENES: ReadonlySet<string> = new Set([SCENES.boot, SCENES.music]);

export interface WebglInfo {
  readonly version: string;
  readonly renderer: string;
  readonly vendor: string;
  readonly maxTextureSize: number | null;
  readonly maxTextureUnits: number | null;
}

export interface StartupReport {
  readonly reason: string;
  readonly errors: readonly string[];
  readonly webgl: WebglInfo | null;
  readonly devicePixelRatio: number;
  readonly screen: string;
  readonly userAgent: string;
}

/** The panel's text, one fact per line (pure, so it is tested without a DOM). */
export function startupReportText(report: StartupReport): string {
  const gl = report.webgl;
  return [
    "The game could not draw on this device.",
    `Reason: ${report.reason}`,
    ...report.errors.map((error) => `Error: ${error}`),
    gl
      ? `WebGL: ${gl.version} · ${gl.renderer} (${gl.vendor}) · max texture ${gl.maxTextureSize ?? "?"} · texture units ${gl.maxTextureUnits ?? "?"}`
      : "WebGL: not available",
    `Screen: ${report.screen} at device pixel ratio ${report.devicePixelRatio}`,
    `Browser: ${report.userAgent}`,
  ].join("\n");
}

/** What this browser's WebGL reports, from a throwaway canvas; null when neither WebGL 2 nor 1 starts. */
export function probeWebgl(doc: Document = document): WebglInfo | null {
  try {
    const canvas = doc.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    const gl = gl2 ?? canvas.getContext("webgl");
    if (!gl) return null;
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const info: WebglInfo = {
      version: gl2 ? "WebGL 2" : "WebGL 1",
      renderer: String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
      vendor: String(gl.getParameter(debug ? debug.UNMASKED_VENDOR_WEBGL : gl.VENDOR)),
      maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || null,
      maxTextureUnits: Number(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)) || null,
    };
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return info;
  } catch {
    return null;
  }
}

const describe = (cause: unknown): string =>
  cause instanceof Error ? `${cause.name}: ${cause.message}` : typeof cause === "string" ? cause : String(cause);

/**
 * Starts watching. Call it before `new Phaser.Game(…)` so an error thrown while the game boots is seen, then hand the
 * game to the returned function once it exists.
 */
export function installStartupWatchdog(): (game: Phaser.Game) => void {
  const errors: string[] = [];
  let started = false;
  let rendered = false;
  let shown = false;

  const show = (reason: string): void => {
    if (shown || document.getElementById(PANEL_ID)) return;
    shown = true;
    const report: StartupReport = {
      reason,
      errors: errors.slice(-5),
      webgl: probeWebgl(),
      devicePixelRatio: window.devicePixelRatio,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: navigator.userAgent,
    };
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.setAttribute("role", "alert");
    panel.style.cssText =
      "position:fixed;inset:0;z-index:10;overflow:auto;padding:24px 16px;box-sizing:border-box;" +
      "background:#0e0c0a;color:#f3ead8;font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word";
    panel.textContent = startupReportText(report);
    const reload = document.createElement("button");
    reload.textContent = "Reload";
    reload.style.cssText = "display:block;margin-top:16px;padding:10px 20px;font:inherit";
    reload.addEventListener("click", () => window.location.reload());
    panel.append(reload);
    document.body.append(panel);
  };

  const onError = (cause: unknown, where: string): void => {
    recordError(cause, where);
    errors.push(describe(cause));
    // An error after the first screen is the frame guard's business (`ui/frame-guard.ts`), not a failed start.
    if (!started) show("an error stopped the game before its first screen");
  };
  window.addEventListener("error", (event) => onError(event.error ?? event.message, "window error"));
  window.addEventListener("unhandledrejection", (event) => onError(event.reason, "unhandled rejection"));

  const firstFrame = window.setTimeout(() => {
    if (!rendered) show(`nothing was drawn in the first ${FIRST_FRAME_MS / 1000} seconds`);
  }, FIRST_FRAME_MS);

  return (game) => {
    game.events.once("postrender", () => {
      rendered = true;
      window.clearTimeout(firstFrame);
    });
    // Any scene past Boot and Music running means the game reached a screen of its own.
    const reachedScreen = (): void => {
      if (!game.scene.getScenes(true).some((scene) => !BOOT_SCENES.has(scene.scene.key))) return;
      started = true;
      game.events.off("poststep", reachedScreen);
    };
    game.events.on("poststep", reachedScreen);
    const watchCanvas = (): void => {
      let restoreTimer: number | undefined;
      game.canvas.addEventListener("webglcontextlost", () => {
        errors.push("WebGL context lost");
        restoreTimer = window.setTimeout(
          () => show(`the WebGL context was lost and not restored within ${RESTORE_GRACE_MS / 1000} seconds`),
          RESTORE_GRACE_MS,
        );
      });
      game.canvas.addEventListener("webglcontextrestored", () => window.clearTimeout(restoreTimer));
    };
    if (game.canvas) watchCanvas();
    else game.events.once("boot", watchCanvas);
  };
}
