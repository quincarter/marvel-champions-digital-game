/**
 * Keeps the game's box on the part of the page the player can see.
 *
 * `#game` is `position: fixed` against the layout viewport. Some mobile browsers (Edge on Android with its address bar
 * at the bottom, and any browser while an on-screen toolbar overlays the page) keep the layout viewport at the full
 * screen height while the visible area (`window.visualViewport`) is shorter, so the bottom of the table, the Setup
 * buttons and the action bar's second row, drew under the toolbar. This trims the box's bottom and asks Phaser to
 * re-measure its parent (RESIZE mode only listens to `window` resize, which does not fire here).
 *
 * The overlap is measured from where the box really ends, not from `innerHeight`: Chrome with its address bar at the
 * bottom reports the same taller layout viewport, but already pins fixed boxes above its toolbar, so trimming by the
 * `innerHeight` difference left a black band there (the owner, 2026-10-24).
 * Pinch-zoom is left alone (`scale !== 1`), and nothing runs where there is no `visualViewport`.
 *
 * Nothing runs edge to edge either (`platform.ts#runsEdgeToEdge`): an app has no browser toolbar to trim for, and
 * Android's WebView reports a visible area far shorter than the screen part way through a rotation (320 at 1280x800),
 * which read as a toolbar and left the game short with a black band below it (#629). A browser can do the same, so a
 * strip too tall to be a toolbar waits until the resizes have settled, when a reading that still stands is believed.
 *
 * The on-screen keyboard is left alone too: it lays over the canvas (#537). `index.html` asks for that with
 * `interactive-widget=overlays-content`; a browser that ignores it shrinks the visible area while a text field has
 * focus, and that shrink is not trimmed for, so the screen never re-lays out for a few letters of typing.
 */
import type Phaser from "phaser";
import { runsEdgeToEdge } from "./platform.js";

/** The most of the box a toolbar usually covers: anything taller may be the browser's numbers mid-rotation. */
const MAX_TOOLBAR_SHARE = 0.25;
/** How long after the last resize the browser's numbers have settled. */
const SETTLE_MS = 400;

/** Pixels of the box, untrimmed, that hang below the visible area, 0 when none or zoomed. */
export function hiddenBottom(boxBottom: number, visibleHeight: number, offsetTop: number, zoom: number): number {
  if (zoom !== 1) return 0;
  const hidden = Math.round(boxBottom - visibleHeight - offsetTop);
  return hidden > 1 ? hidden : 0;
}

/** Whether a hidden strip should wait: too tall for a toolbar, while the browser may still be mid-rotation. */
export function waitsToSettle(hidden: number, boxBottom: number, settled: boolean): boolean {
  return !settled && hidden > boxBottom * MAX_TOOLBAR_SHARE;
}

/** True while a text field has focus, when a shrunken visible area is the on-screen keyboard rather than a toolbar. */
export function typingInto(element: Element | null): boolean {
  if (element === null) return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (element as HTMLElement).isContentEditable === true;
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
  if (!viewport || !box || runsEdgeToEdge()) return;
  let applied = 0;
  let queued = false;
  let settling = 0;
  let settled = false;
  const apply = (): void => {
    queued = false;
    const stable = settled;
    settled = false;
    // Keep whatever trim the toolbar had: the keyboard covers the canvas, it doesn't resize it.
    if (typingInto(document.activeElement)) return;
    // The box's bottom as it would sit without the trim already applied.
    const boxBottom = box.getBoundingClientRect().bottom + applied;
    const strip = hiddenBottom(boxBottom, viewport.height, viewport.offsetTop, viewport.scale);
    if (waitsToSettle(strip, boxBottom, stable)) return;
    const hidden = boxTrim(strip);
    if (hidden === applied) return;
    applied = hidden;
    // The safe-area inset (index.html) still applies; the toolbar's share is added on top of it.
    box.style.bottom = hidden > 0 ? `calc(env(safe-area-inset-bottom, 0px) + ${hidden}px)` : "";
    // `refresh` alone keeps the size Phaser last measured, so the canvas would stay as it was until its next check.
    game.scale.getParentBounds();
    game.scale.refresh();
  };
  const queue = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  };
  const queueAndSettle = (): void => {
    queue();
    window.clearTimeout(settling);
    settling = window.setTimeout(() => {
      settled = true;
      queue();
    }, SETTLE_MS);
  };
  viewport.addEventListener("resize", queueAndSettle);
  // Leaving a text field re-measures, in case a toolbar came or went while the keyboard was up.
  document.addEventListener("focusout", queueAndSettle);
  window.addEventListener("resize", queueAndSettle);
  window.addEventListener("orientationchange", queueAndSettle);
  queueAndSettle();
}
