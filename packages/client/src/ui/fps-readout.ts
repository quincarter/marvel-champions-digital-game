/**
 * `?fps=1`: a small frame-rate readout in the corner, for telling on a real phone whether a slow screen is the script
 * or the GPU. Every half second it shows the frames run, the frames actually drawn (`ui/idle-render.ts` skips the
 * rest), the longest gap between frames, and the script time of the average and slowest step (update plus draw call;
 * the GPU's own work is not in it). Script time low and gaps long means the GPU or the compositor is behind.
 *
 * The last line counts how often the connected controller's state actually changed (its `timestamp`), to tell a
 * slow game from a webview that hands controller input over only now and then.
 *
 * Off unless asked for: nothing is installed, and no frame pays for it. Ctrl+Shift+F shows or hides it anywhere, the
 * desktop app included, where there is no address bar for the flag (`installFpsHotkey`).
 */
import Phaser from "phaser";

const WINDOW_MS = 500;

export function fpsReadoutWanted(search: string): boolean {
  return new URLSearchParams(search).get("fps") === "1";
}

let box: HTMLDivElement | null = null;

/** Ctrl+Shift+F: shows the readout, installing it on first use, or hides it again. */
export function installFpsHotkey(game: Phaser.Game): void {
  window.addEventListener("keydown", (event) => {
    if (!event.ctrlKey || !event.shiftKey || event.code !== "KeyF") return;
    event.preventDefault();
    if (box === null) installFpsReadout(game);
    else box.hidden = !box.hidden;
  });
}

export function installFpsReadout(game: Phaser.Game): void {
  if (box !== null) return;
  const readout = document.createElement("div");
  box = readout;
  readout.style.cssText =
    "position:fixed;top:0;left:0;z-index:20;pointer-events:none;padding:2px 6px;" +
    "font:12px/1.3 monospace;color:#0f0;background:rgba(0,0,0,0.75);white-space:pre";
  document.body.appendChild(readout);

  let windowStart = performance.now();
  let lastFrame = windowStart;
  let frames = 0;
  let draws = 0;
  let worstGap = 0;
  let stepTotal = 0;
  let worstStep = 0;
  let stepStart = 0;
  let padStamp = Number.NaN;
  let padChanges = 0;

  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    const now = performance.now();
    worstGap = Math.max(worstGap, now - lastFrame);
    lastFrame = now;
    stepStart = now;
    frames++;
    const pad = (globalThis.navigator?.getGamepads?.() ?? []).find((candidate) => candidate?.connected);
    if (pad && pad.timestamp !== padStamp) {
      padStamp = pad.timestamp;
      padChanges++;
    }
  });
  // POST_STEP ends a step the idle render skipped; POST_RENDER ends one it drew. Either way the later one counts.
  const endStep = (): void => {
    const spent = performance.now() - stepStart;
    stepTotal += spent;
    worstStep = Math.max(worstStep, spent);
  };
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    draws++;
    endStep();
  });

  window.setInterval(() => {
    const now = performance.now();
    const seconds = (now - windowStart) / 1000;
    const { width, height } = game.canvas;
    if (!readout.hidden)
      readout.textContent =
        `${(frames / seconds).toFixed(0)} fps  ${(draws / seconds).toFixed(0)} drawn/s  worst gap ${worstGap.toFixed(0)} ms\n` +
        `drawn step avg ${(draws ? stepTotal / draws : 0).toFixed(1)} ms  max ${worstStep.toFixed(1)} ms  ` +
        `canvas ${width}x${height}` +
        (Number.isNaN(padStamp) ? "" : `\ncontroller updates ${(padChanges / seconds).toFixed(0)}/s`);
    windowStart = now;
    frames = 0;
    draws = 0;
    worstGap = 0;
    stepTotal = 0;
    worstStep = 0;
    padChanges = 0;
  }, WINDOW_MS);
}
