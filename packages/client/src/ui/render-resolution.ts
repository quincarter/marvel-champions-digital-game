/**
 * Draws the game at a fixed resolution scaled up to fill the window, black bars where the shapes differ: the desktop
 * app's Borderless and Fullscreen modes at a resolution below native (`platform/desktop-window.ts#renderSizeOf`).
 *
 * The game normally runs in Phaser's RESIZE mode, where the canvas is its parent's size in CSS pixels (`main.ts`). A
 * fixed resolution switches it to FIT: the canvas's drawing buffer is the chosen size, Phaser scales it to fit #game
 * and centres it, and maps pointer input and the DOM text fields through that same scale. Scenes see the chosen size
 * as `scale.gameSize` and get the usual `resize` event, so they lay out for it as they would for a window that size.
 *
 * Couch mode (`applyCouchMode`) uses the same FIT path at a smaller game size. Under `?renderer=canvas` the render scale
 * (`ui/render-scale.ts`) never installs, so the scaled-up game is soft there.
 */
import Phaser from "phaser";
import { couchFactorFor, couchSizeOf, type CouchSize } from "../view/couch-mode.js";

/** The letterbox colour: the bars read as the screen's edge, not as part of the table. */
const BARS = "#000";

type Size = CouchSize;

/** The desktop app's fixed resolution (`applyRenderSize`), or null for the window's own size. */
let fixed: Size | null = null;
/** Couch mode's factor (`applyCouchMode`): 1 is off. */
let couch = 1;
/** The factor couch mode really uses now (`couchFactorFor` on this window), and who to tell when it moves. */
let used = 1;
let usedHandler: (() => void) | null = null;
let watching: { readonly parent: HTMLElement; readonly observer: ResizeObserver } | null = null;

/** Draws the game at a fixed resolution scaled to fit the window (null: back to the window's own size). */
export function applyRenderSize(game: Phaser.Game, size: Size | null): void {
  fixed = size;
  refit(game);
}

/** The factor couch mode really uses now: the choice, lowered where the window is too small for it (1 when off). */
export function couchFactorInUse(): number {
  return used;
}

/** Called once; the handler runs after a refit changed the factor in use (a resize can), to redraw at scale. */
export function setCouchFactorHandler(handler: () => void): void {
  usedHandler = handler;
}

/** The size couch mode divides: the fixed resolution, else #game's own size; null before #game has one. */
export function couchBaseSize(game: Phaser.Game): Size | null {
  const parent = game.scale.parent as HTMLElement | null;
  if (fixed !== null) return fixed;
  if (parent === null || parent.clientWidth <= 0 || parent.clientHeight <= 0) return null;
  return { width: parent.clientWidth, height: parent.clientHeight };
}

/**
 * Couch mode: the game lays out at the window's size divided by `factor` and Phaser scales it up to fill, so
 * everything is `factor` times bigger with no bars (the aspect is the window's). On top of a fixed resolution it
 * divides that instead. Follows the window: a resize, a rotation, and the visible-area trim
 * (`platform/visible-area.ts`) all resize #game, which a ResizeObserver reports. 1 returns to RESIZE exactly as
 * without it.
 */
export function applyCouchMode(game: Phaser.Game, factor: number): void {
  couch = Math.max(1, factor);
  refit(game);
}

function targetOf(game: Phaser.Game): { readonly size: Size; readonly factor: number } | null {
  const base = couchBaseSize(game);
  if (base === null || (couch <= 1 && fixed === null)) return null;
  const factor = couchFactorFor(couch, base);
  return { size: couchSizeOf(base, factor), factor };
}

function refit(game: Phaser.Game): void {
  const scale = game.scale as Phaser.Scale.ScaleManager & {
    scaleMode: Phaser.Scale.ScaleModeType;
    autoCenter: Phaser.Scale.CenterType;
  };
  const parent = scale.parent as HTMLElement | null;
  watchParent(game, fixed === null && couch > 1 ? parent : null);
  const target = targetOf(game);
  const size = target?.size ?? null;
  const factor = target?.factor ?? 1;
  if (size === null) {
    if (scale.scaleMode === Phaser.Scale.RESIZE) {
      publish(factor);
      return;
    }
    scale.scaleMode = Phaser.Scale.RESIZE;
    scale.autoCenter = Phaser.Scale.NO_CENTER;
    scale.displaySize.setAspectMode(Phaser.Structs.Size.NONE);
    // FIT sizes and centres the canvas with inline styles; RESIZE never writes them, so they would stay behind and
    // keep the game stretched to the old fit (a 1920 x 1080 canvas drawn 2560 wide after Borderless).
    game.canvas.style.marginLeft = "";
    game.canvas.style.marginTop = "";
    game.canvas.style.width = "";
    game.canvas.style.height = "";
    if (parent !== null) parent.style.background = "";
    scale.refresh();
    publish(factor);
    return;
  }
  scale.scaleMode = Phaser.Scale.FIT;
  scale.autoCenter = Phaser.Scale.CENTER_BOTH;
  // Phaser sets the display size's aspect mode only at boot, from the configured scale mode (RESIZE leaves it free).
  scale.displaySize.setAspectMode(Phaser.Structs.Size.FIT);
  scale.displaySize.setParent(scale.parentSize);
  if (parent !== null) parent.style.background = BARS;
  scale.setGameSize(size.width, size.height);
  scale.refresh();
  publish(factor);
}

function publish(factor: number): void {
  if (factor === used) return;
  used = factor;
  usedHandler?.();
}

/** While couch mode follows the window, re-fits whenever #game changes size; stops otherwise. */
function watchParent(game: Phaser.Game, parent: HTMLElement | null): void {
  if (watching?.parent === parent) return;
  watching?.observer.disconnect();
  watching = null;
  if (parent === null || typeof ResizeObserver === "undefined") return;
  const observer = new ResizeObserver(() => {
    const size = targetOf(game)?.size;
    const now = game.scale.gameSize;
    if (size !== undefined && (size.width !== now.width || size.height !== now.height)) refit(game);
  });
  observer.observe(parent);
  watching = { parent, observer };
}
