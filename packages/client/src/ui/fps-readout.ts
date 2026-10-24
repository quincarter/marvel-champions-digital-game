/**
 * `?fps=1`: a small frame-rate readout in the corner, for telling on a real phone whether a slow screen is the script
 * or the GPU. Every half second it shows the frames run, the frames actually drawn (`ui/idle-render.ts` skips the
 * rest), the longest gap between frames, and the script time of the average and slowest step (update plus draw call;
 * the GPU's own work is not in it). Script time low and gaps long means the GPU or the compositor is behind.
 *
 * Off unless asked for: nothing is installed, and no frame pays for it.
 */
import Phaser from "phaser";

const WINDOW_MS = 500;

export function fpsReadoutWanted(search: string): boolean {
  return new URLSearchParams(search).get("fps") === "1";
}

export function installFpsReadout(game: Phaser.Game): void {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;top:0;left:0;z-index:20;pointer-events:none;padding:2px 6px;" +
    "font:12px/1.3 monospace;color:#0f0;background:rgba(0,0,0,0.75);white-space:pre";
  document.body.appendChild(box);

  let windowStart = performance.now();
  let lastFrame = windowStart;
  let frames = 0;
  let draws = 0;
  let worstGap = 0;
  let stepTotal = 0;
  let worstStep = 0;
  let stepStart = 0;

  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    const now = performance.now();
    worstGap = Math.max(worstGap, now - lastFrame);
    lastFrame = now;
    stepStart = now;
    frames++;
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
    box.textContent =
      `${(frames / seconds).toFixed(0)} fps  ${(draws / seconds).toFixed(0)} drawn/s  worst gap ${worstGap.toFixed(0)} ms\n` +
      `drawn step avg ${(draws ? stepTotal / draws : 0).toFixed(1)} ms  max ${worstStep.toFixed(1)} ms  ` +
      `canvas ${width}x${height}`;
    windowStart = now;
    frames = 0;
    draws = 0;
    worstGap = 0;
    stepTotal = 0;
    worstStep = 0;
  }, WINDOW_MS);
}
