/**
 * Keeps the game's box on the part of the page the player can see.
 *
 * `#game` is `position: fixed` against the layout viewport. Some mobile browsers (Edge on Android with its address bar
 * at the bottom, and any browser while an on-screen toolbar overlays the page) keep the layout viewport at the full
 * screen height while the visible area (`window.visualViewport`) is shorter, so the bottom of the table, the Setup
 * buttons and the action bar's second row, drew under the toolbar. This trims the box's bottom by the difference and
 * asks Phaser to re-measure its parent (RESIZE mode only listens to `window` resize, which does not fire here).
 * Pinch-zoom is left alone (`scale !== 1`), and nothing runs where there is no `visualViewport`.
 */
import type Phaser from "phaser";

/** Pixels of the layout viewport's bottom that the visible area leaves uncovered, 0 when none or zoomed. */
export function hiddenBottom(layoutHeight: number, visibleHeight: number, offsetTop: number, zoom: number): number {
  if (zoom !== 1) return 0;
  const hidden = Math.round(layoutHeight - visibleHeight - offsetTop);
  return hidden > 1 ? hidden : 0;
}

/**
 * How much of that hidden strip the box gives up. Edge reports its whole floating address bar band as covered, though
 * its top part stays visible; the owner asked to split the difference (2026-10-24): half, so the table reaches a little
 * further down without a control going under the bar itself.
 */
export function boxTrim(hidden: number): number {
  return Math.round(hidden / 2);
}

export function installVisibleArea(game: Phaser.Game): void {
  const viewport = window.visualViewport;
  const box = document.getElementById("game");
  if (!viewport || !box) return;
  let applied = 0;
  let queued = false;
  const apply = (): void => {
    queued = false;
    const hidden = boxTrim(hiddenBottom(window.innerHeight, viewport.height, viewport.offsetTop, viewport.scale));
    if (hidden === applied) return;
    applied = hidden;
    // The safe-area inset (index.html) still applies; the toolbar's share is added on top of it.
    box.style.bottom = hidden > 0 ? `calc(env(safe-area-inset-bottom, 0px) + ${hidden}px)` : "";
    game.scale.refresh();
  };
  const queue = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  };
  viewport.addEventListener("resize", queue);
  window.addEventListener("resize", queue);
  window.addEventListener("orientationchange", queue);
  queue();
}
