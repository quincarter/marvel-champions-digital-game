/**
 * A Lit panel (`@mc/ui`) mounted for one Phaser scene, at a layout `Rect`, in the panel layer over the canvas
 * (`dom/ui-layer.ts`). The scene keeps everything else: its own chrome (top bar, Back, glyph hints), navigation,
 * focus route and store subscriptions. The panel only shows what the scene hands it.
 *
 * The region follows its scene, so the two read as one screen (`sceneLayerState`, shared with the DOM focus ring):
 * - it is removed when the scene shuts down, and hidden while the scene sleeps, pauses or is hidden;
 * - it fades with the scene's camera (`fadeScreenIn`, `goToScreen`'s fade-out, a held entrance), since a camera fade
 *   only darkens the canvas;
 * - it hides while a scene drawn above this one is up (an overlay), since the DOM always sits over the canvas and
 *   would otherwise cover it;
 * - a chrome scene's objects (`CHROME_SCENES`: a toast, the corner buttons) are cut out of it, so a toast that lands
 *   over the panel is seen and can be pressed (a clip path also clips hit testing).
 *
 * Under the panel, Phaser still hit-tests a press (its pointer listeners are on the window): a panel must not sit over
 * live Phaser controls.
 *
 * `data-scene` names the scene, so e2e text search (`e2e/helpers.ts`) reports a panel's text under it.
 */
import type Phaser from "phaser";
import type { Rect } from "../view/layout.js";
import { CHROME_SCENES } from "../scenes/keys.js";
import { uiLayer } from "./ui-layer.js";

/** The camera fade's current darkness, 0 (none) to 1 (black), as `Phaser.Cameras.Scene2D.Effects.Fade` holds it. */
interface FadeLike {
  readonly isRunning: boolean;
  readonly isComplete: boolean;
  readonly alpha: number;
}

/** How visible a region is under its scene's camera: 1 minus the fade's darkness, times the camera's own alpha. */
export function regionOpacity(fade: FadeLike | undefined, cameraAlpha: number): number {
  const dark = fade && (fade.isRunning || fade.isComplete) ? fade.alpha : 0;
  return Math.max(0, Math.min(1, (1 - dark) * cameraAlpha));
}

/** The slice of a scene the cover check reads. */
export interface SceneLike {
  readonly key: string;
  readonly active: boolean;
  readonly visible: boolean;
}

/** Whether a scene drawn above `key` (later in `scenes`, the draw order) is up and isn't chrome. */
export function coveredAbove(scenes: readonly SceneLike[], key: string, chrome: ReadonlySet<string>): boolean {
  const at = scenes.findIndex((scene) => scene.key === key);
  if (at < 0) return false;
  for (let index = at + 1; index < scenes.length; index++) {
    const scene = scenes[index]!;
    if (scene.active && scene.visible && !chrome.has(scene.key)) return true;
  }
  return false;
}

/** Whether a scene's DOM (its panel, its focus ring) shows right now, and how opaque. */
export function sceneLayerState(scene: Phaser.Scene): { readonly shown: boolean; readonly opacity: number } {
  const settings = scene.sys.settings;
  const scenes: SceneLike[] = scene.game.scene.scenes.map((other) => ({
    key: other.sys.settings.key,
    active: other.sys.isActive(),
    visible: other.sys.settings.visible,
  }));
  const shown = settings.visible && scene.sys.isActive() && !coveredAbove(scenes, settings.key, CHROME_SCENES);
  const camera = scene.cameras?.main;
  const opacity = camera ? regionOpacity(camera.fadeEffect as unknown as FadeLike, camera.alpha) : 1;
  return { shown, opacity };
}

/** The layer's own scale on the page: Phaser scales its DOM container with the canvas in FIT mode (couch mode). */
function layerScale(layer: HTMLElement): number {
  const width = layer.offsetWidth;
  return width > 0 ? layer.getBoundingClientRect().width / width : 1;
}

/** An element's box in game coordinates: relative to the layer, divided by the layer's scale. */
export function gameRectOf(target: Element, layer: HTMLElement): Rect {
  const box = target.getBoundingClientRect();
  const origin = layer.getBoundingClientRect();
  const scale = layerScale(layer) || 1;
  return {
    x: (box.left - origin.left) / scale,
    y: (box.top - origin.top) / scale,
    width: box.width / scale,
    height: box.height / scale,
  };
}

/**
 * `rects` as disjoint rectangles covering the same area (their union), so overlapping cutouts cut once: the even-odd
 * rule would put the panel back wherever two holes overlap. Split on every hole edge and keep the covered cells,
 * merging each run of covered cells along a row.
 */
export function disjointUnion(rects: readonly Rect[]): Rect[] {
  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.width]))].sort((a, b) => a - b);
  const ys = [...new Set(rects.flatMap((r) => [r.y, r.y + r.height]))].sort((a, b) => a - b);
  const covered = (x: number, y: number): boolean =>
    rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
  const out: Rect[] = [];
  for (let row = 0; row + 1 < ys.length; row++) {
    const top = ys[row]!;
    const bottom = ys[row + 1]!;
    let runStart: number | null = null;
    for (let col = 0; col + 1 < xs.length; col++) {
      const inside = covered(xs[col]!, top);
      if (inside && runStart === null) runStart = xs[col]!;
      if (!inside && runStart !== null) {
        out.push({ x: runStart, y: top, width: xs[col]! - runStart, height: bottom - top });
        runStart = null;
      }
    }
    if (runStart !== null)
      out.push({ x: runStart, y: top, width: xs[xs.length - 1]! - runStart, height: bottom - top });
  }
  return out;
}

/** A CSS clip path (even-odd) covering `box` with `holes` cut out of it, in the box's own coordinates; null for none. */
export function clipWithHoles(box: Rect, holes: readonly Rect[]): string | null {
  const clipped = holes
    .map((hole) => {
      const x = Math.max(0, hole.x - box.x);
      const y = Math.max(0, hole.y - box.y);
      return {
        x,
        y,
        width: Math.min(box.width, hole.x + hole.width - box.x) - x,
        height: Math.min(box.height, hole.y + hole.height - box.y) - y,
      };
    })
    .filter((hole) => hole.width > 0 && hole.height > 0);
  if (clipped.length === 0) return null;
  const outer = `M0 0H${box.width}V${box.height}H0Z`;
  const inner = disjointUnion(clipped)
    .map((h) => `M${h.x} ${h.y}H${h.x + h.width}V${h.y + h.height}H${h.x}Z`)
    .join("");
  return `path(evenodd, "${outer}${inner}")`;
}

/** The boxes a chrome scene draws (a toast, a corner button) while it is up, in game coordinates. */
function chromeBoxes(game: Phaser.Game): Rect[] {
  const boxes: Rect[] = [];
  for (const scene of game.scene.scenes) {
    if (!CHROME_SCENES.has(scene.sys.settings.key) || !scene.sys.isActive() || !scene.sys.settings.visible) continue;
    for (const object of scene.children.list) {
      const shown = object as unknown as {
        visible?: boolean;
        alpha?: number;
        getBounds?: () => { x: number; y: number; width: number; height: number };
      };
      if (shown.visible === false || shown.alpha === 0 || !shown.getBounds) continue;
      const b = shown.getBounds();
      if (b.width > 0 && b.height > 0) boxes.push({ x: b.x, y: b.y, width: b.width, height: b.height });
    }
  }
  return boxes;
}

const STATE_EVENTS = ["sleep", "pause", "wake", "resume"] as const;

/** A Phaser object a region moves and fades with (an overlay panel's entrance and exit, `ui/transitions.ts`). */
export interface Followed {
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
  readonly active: boolean;
}

/** Renders a Lit element's pending update now, so its elements exist for a focus stop read in the same frame. */
export function renderNow(element: HTMLElement): void {
  (element as unknown as { performUpdate?: () => void }).performUpdate?.();
}

export class DomRegion<E extends HTMLElement = HTMLElement> {
  readonly element: E;
  readonly #scene: Phaser.Scene;
  readonly #wrap: HTMLDivElement;
  readonly #layer: HTMLElement;
  #rect: Rect;
  #opacity = -1;
  #shown: boolean | null = null;
  #clip: string | null = null;
  #live: boolean | null = null;
  #hidden = false;
  #holes: readonly Rect[] = [];
  #follow: Followed | null = null;
  #offset = "";
  #destroyed = false;

  constructor(scene: Phaser.Scene, element: E, rect: Rect) {
    this.#scene = scene;
    this.element = element;
    this.#rect = rect;
    this.#layer = uiLayer(scene.game);
    this.#wrap = document.createElement("div");
    this.#wrap.dataset.scene = scene.sys.settings.key;
    Object.assign(this.#wrap.style, { position: "absolute", pointerEvents: "auto", opacity: "0" });
    this.#wrap.append(element);
    this.#layer.append(this.#wrap);
    this.setRect(rect);
    this.#sync();
    scene.events.on("postupdate", this.#sync, this);
    // Phaser doesn't step a sleeping or paused scene, so those are heard as events.
    for (const event of STATE_EVENTS) scene.events.on(event, this.#sync, this);
    scene.events.once("shutdown", this.destroy, this);
    scene.events.once("destroy", this.destroy, this);
  }

  /** Moves and sizes the region (a resize, a new layout). */
  setRect(rect: Rect): void {
    this.#rect = rect;
    Object.assign(this.#wrap.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  /**
   * Leaves `rects` (game coordinates) out of the panel, seen and pressed through it: a Phaser DOM element the scene
   * keeps under the panel (a search field, `McTextInput`), which would otherwise be covered.
   */
  setHoles(rects: readonly Rect[]): void {
    this.#holes = rects;
    this.#sync();
  }

  /** Hides the region whatever its scene does (the scene shows something else in its place for now). */
  setHidden(hidden: boolean): void {
    this.#hidden = hidden;
    this.#sync();
  }

  /**
   * Moves and fades with `object`: an overlay panel drawn at its place with `x` and `y` 0 at rest, which its entrance
   * and exit tween (`OverlayMotion`), so the DOM body rises and fades with the Phaser panel around it.
   */
  follow(object: Followed | null): void {
    this.#follow = object;
    this.#sync();
  }

  /** The region's box, in game coordinates (what a focus stop's `view` is). */
  get rect(): Rect {
    return this.#rect;
  }

  /** An element inside the panel, in game coordinates. */
  rectOf(target: Element): Rect {
    return gameRectOf(target, this.#layer);
  }

  #sync(): void {
    if (this.#destroyed) return;
    const state = sceneLayerState(this.#scene);
    const follow = this.#follow?.active ? this.#follow : null;
    const shown = state.shown && !this.#hidden;
    const opacity = state.opacity * (follow ? follow.alpha : 1);
    const offset = follow && (follow.x !== 0 || follow.y !== 0) ? `translate(${follow.x}px, ${follow.y}px)` : "";
    if (offset !== this.#offset) {
      this.#offset = offset;
      this.#wrap.style.transform = offset;
    }
    if (shown !== this.#shown) {
      this.#shown = shown;
      this.#wrap.style.visibility = shown ? "visible" : "hidden";
    }
    if (Math.abs(opacity - this.#opacity) > 0.001) {
      this.#opacity = opacity;
      this.#wrap.style.opacity = String(opacity);
    }
    // Presses follow the scene's own input: an overlay playing its exit turns its input off (`exitOverlay`), and its
    // panel stops taking taps with it.
    const live = this.#scene.input?.enabled !== false;
    if (live !== this.#live) {
      this.#live = live;
      this.#wrap.style.pointerEvents = live ? "auto" : "none";
    }
    const clip = shown ? clipWithHoles(this.#rect, [...chromeBoxes(this.#scene.game), ...this.#holes]) : null;
    if (clip !== this.#clip) {
      this.#clip = clip;
      this.#wrap.style.clipPath = clip ?? "";
    }
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#scene.events.off("postupdate", this.#sync, this);
    for (const event of STATE_EVENTS) this.#scene.events.off(event, this.#sync, this);
    this.#scene.events.off("shutdown", this.destroy, this);
    this.#scene.events.off("destroy", this.destroy, this);
    this.#wrap.remove();
  }
}
