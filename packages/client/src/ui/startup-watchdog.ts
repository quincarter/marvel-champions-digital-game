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
 *
 * It also moves `window.__mcBoot.stage` along (module, game, frame, screen) for the plain script in `index.html`,
 * which reports a start that never got that far, a module that never ran included. `?diag=1` adds a strip across the
 * top once a screen is up: the renderer, the canvas and drawing-buffer sizes, and the colour of the centre pixel as
 * WebGL drew it, so a device that draws but shows black (Edge on Android, #157) can be told from one that never drew.
 */
import type Phaser from "phaser";
import { SCENES } from "../scenes/keys.js";
import { recordError } from "./error-log.js";

const FIRST_FRAME_MS = 20_000;
const RESTORE_GRACE_MS = 3_000;
const PANEL_ID = "mc-startup-failure";
// The Report button (#176) runs from Boot too: it is chrome, not a screen.
const BOOT_SCENES: ReadonlySet<string> = new Set([SCENES.boot, SCENES.music, SCENES.reportButton, SCENES.musicButton]);

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

type BootStage = "module" | "game" | "frame" | "screen";

/** Moves the `index.html` watchdog's stage along. */
function reach(stage: BootStage): void {
  const boot = (window as { __mcBoot?: { stage: string } }).__mcBoot;
  if (boot) boot.stage = stage;
}

/** The centre pixel of the frame just drawn, as WebGL holds it ("rgba(14,12,10,255)"); null under Canvas. */
function centrePixel(game: Phaser.Game): string | null {
  const gl = (game.renderer as { gl?: WebGLRenderingContext }).gl;
  if (!gl) return null;
  const pixel = new Uint8Array(4);
  gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return `rgba(${pixel.join(",")})`;
}

/** `?diag=1`'s strip: one line over the top of the game, removed by a tap. */
function showDiagnostics(game: Phaser.Game): void {
  const gl = (game.renderer as { gl?: WebGLRenderingContext }).gl;
  const info = probeWebgl();
  const strip = document.createElement("div");
  strip.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:11;padding:6px 8px;background:rgba(0,0,0,0.85);color:#f3ead8;" +
    "font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word";
  strip.textContent = [
    `diag ${window.location.search} · ${gl ? "WebGL" : "Canvas"} renderer · ${info ? `${info.version} ${info.renderer}` : "no WebGL"}`,
    `canvas ${game.canvas.width}x${game.canvas.height} · css ${game.canvas.clientWidth}x${game.canvas.clientHeight}` +
      (gl ? ` · buffer ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}` : "") +
      ` · dpr ${window.devicePixelRatio}` +
      (gl ? ` · multisampled ${game.config.antialiasGL ? "yes" : "no"}` : ""),
    `centre pixel ${centrePixel(game) ?? "n/a"} · ${navigator.userAgent}`,
  ].join("\n");
  strip.addEventListener("click", () => strip.remove());
  document.body.append(strip);
}

const describe = (cause: unknown): string =>
  cause instanceof Error ? `${cause.name}: ${cause.message}` : typeof cause === "string" ? cause : String(cause);

/**
 * Starts watching. Call it before `new Phaser.Game(…)` so an error thrown while the game boots is seen, then hand the
 * game to the returned function once it exists.
 */
export function installStartupWatchdog(): (game: Phaser.Game) => void {
  reach("module");
  const diagnose = new URLSearchParams(window.location.search).get("diag") === "1";
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
    reach("game");
    game.events.once("postrender", () => {
      reach("frame");
      rendered = true;
      window.clearTimeout(firstFrame);
    });
    // Any scene past Boot and Music running means the game reached a screen of its own.
    const reachedScreen = (): void => {
      if (!game.scene.getScenes(true).some((scene) => !BOOT_SCENES.has(scene.scene.key))) return;
      started = true;
      reach("screen");
      game.events.off("poststep", reachedScreen);
      // Read in the frame after the screen first draws, while its drawing buffer still holds it.
      if (diagnose) window.setTimeout(() => game.events.once("postrender", () => showDiagnostics(game)), 2000);
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
