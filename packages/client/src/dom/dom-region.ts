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
 *   would otherwise cover it, unless that scene is itself an `overlay` region (a pop-up that draws its own scrim and
 *   panel in the DOM, above this one), which leaves this panel shown under it;
 * - it stacks in the scenes' draw order (`panelZIndex`), so a pop-up scene's panel drawn above this scene's sits
 *   above it;
 * - a region made with `shownUnder` stays shown under the scenes it names (a bar that covers only its own corner of the
 *   screen, like the replay transport, leaves a panel elsewhere on the screen uncovered; such a scene must not draw over
 *   the panel's box, since the DOM would hide what it drew there);
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
import { sceneTakesPresses } from "./activation-gate.js";
import { cancelPressesWithin } from "@mc/ui/tap";
import { drawnChromeBoxes, type DrawnObject } from "./chrome-holes.js";
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
  /** Drawn this frame: running, or paused (a paused scene still renders); not sleeping or stopped. */
  readonly active: boolean;
  readonly visible: boolean;
  /** Draws its own scrim and panel in the DOM (`DomRegion`'s `overlay`), so a panel under it stays shown. */
  readonly overlay?: boolean;
}

/**
 * The CSS z-index of a scene's panel wrapper: its place in the scenes' draw order (`game.scene.scenes`), so a panel
 * drawn by a scene above sits above this one. Ten apart, so the scene's focus ring sits just over its own panel
 * (`ringZIndex`) and under the next scene's. 0 (no stacking) for a scene not in the list.
 */
export function panelZIndex(scenes: readonly { readonly key: string }[], key: string): number {
  const at = scenes.findIndex((scene) => scene.key === key);
  return at < 0 ? 0 : (at + 1) * 10;
}

/** The z-index of a scene's focus ring: over its own panel, under the panel of the scene above. */
export function ringZIndex(scenes: readonly { readonly key: string }[], key: string): number {
  const panel = panelZIndex(scenes, key);
  return panel === 0 ? 10 : panel + 5;
}

/** Scene keys whose live region is an overlay (`DomRegion`'s `overlay` option). */
const overlayScenes = new Set<string>();

/**
 * The holes (a Phaser text field) each overlay region leaves, by scene key. A Phaser DOM element sits under every
 * panel, so a panel below the overlay is cut at the same places, or it would cover the field through the hole.
 */
const overlayHoles = new Map<string, readonly Rect[] | (() => readonly Rect[])>();

/** Every live region, so one overlay's holes reach the panels under it at once. */
const liveRegions = new Set<{ readonly resync: () => void }>();

/** Re-reads every live region's cut-outs now: a card hover popover that has just gone must stop cutting its hole at once. */
export function resyncLiveRegions(): void {
  for (const region of liveRegions) region.resync();
}

/** The holes of overlay scenes drawn above `key` (later in the draw order), in game coordinates. */
export function holesAbove(scenes: readonly { readonly key: string }[], key: string): Rect[] {
  const at = scenes.findIndex((scene) => scene.key === key);
  if (at < 0) return [];
  return scenes.slice(at + 1).flatMap((scene) => {
    const holes = overlayHoles.get(scene.key);
    return typeof holes === "function" ? holes() : (holes ?? []);
  });
}

const NO_SCENES: ReadonlySet<string> = new Set();

/** Whether a scene drawn above `key` (later in `scenes`, the draw order) is drawn and isn't chrome. */
export function coveredAbove(
  scenes: readonly SceneLike[],
  key: string,
  chrome: ReadonlySet<string>,
  /** Scenes the panel stays shown under (`DomRegion`'s `shownUnder`). */
  passes: ReadonlySet<string> = NO_SCENES,
): boolean {
  const at = scenes.findIndex((scene) => scene.key === key);
  if (at < 0) return false;
  for (let index = at + 1; index < scenes.length; index++) {
    const scene = scenes[index]!;
    if (scene.active && scene.visible && !chrome.has(scene.key) && !passes.has(scene.key) && !scene.overlay)
      return true;
  }
  return false;
}

/**
 * Whether a scene drawn above `key` takes input from it: as `coveredAbove`, but a DOM overlay (a pop-up) counts too.
 * Such a panel stays drawn under its pop-up, dimmed, yet must take no press: a finger already down on it would lift
 * through implicit pointer capture and still change the setting under the prompt. Chrome scenes and `passes` let input
 * through, as they do for the render check.
 */
export function inputCoveredAbove(
  scenes: readonly SceneLike[],
  key: string,
  chrome: ReadonlySet<string>,
  passes: ReadonlySet<string> = NO_SCENES,
): boolean {
  return coveredAbove(
    scenes.map((scene) => ({ ...scene, overlay: false })),
    key,
    chrome,
    passes,
  );
}

function sceneLikes(scene: Phaser.Scene): SceneLike[] {
  return scene.game.scene.scenes.map((other) => ({
    key: other.sys.settings.key,
    active: other.sys.isActive() || other.sys.isPaused(),
    visible: other.sys.settings.visible,
    overlay: overlayScenes.has(other.sys.settings.key),
  }));
}

/** Whether a scene drawn above this one (a pop-up included) takes its input away. */
export function sceneInputCovered(scene: Phaser.Scene, passes: ReadonlySet<string> = NO_SCENES): boolean {
  return inputCoveredAbove(sceneLikes(scene), scene.sys.settings.key, CHROME_SCENES, passes);
}

/** Whether a scene's DOM (its panel, its focus ring) shows right now, and how opaque. */
export function sceneLayerState(
  scene: Phaser.Scene,
  passes: ReadonlySet<string> = NO_SCENES,
): { readonly shown: boolean; readonly opacity: number } {
  const settings = scene.sys.settings;
  const scenes = sceneLikes(scene);
  const shown = settings.visible && scene.sys.isActive() && !coveredAbove(scenes, settings.key, CHROME_SCENES, passes);
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

/**
 * The boxes a chrome scene draws (a toast, a corner button) while it is up, in game coordinates, for the scenes drawn
 * above `key` only: a chrome scene below a pop-up (the Report dialog is brought to the top, over the corner buttons)
 * is covered by it, as Phaser covered it, so it must not be cut out of the pop-up's panel and show through its scrim.
 */
function chromeBoxes(game: Phaser.Game, region: Rect, key: string): Rect[] {
  const boxes: Rect[] = [];
  const order = game.scene.scenes;
  const at = order.findIndex((scene) => scene.sys.settings.key === key);
  for (const [index, scene] of order.entries()) {
    if (at >= 0 && index < at) continue;
    const drawn = scene.sys.isActive() || scene.sys.isPaused();
    if (!CHROME_SCENES.has(scene.sys.settings.key) || !drawn || !scene.sys.settings.visible) continue;
    const camera = scene.cameras?.main;
    // A scene fading out (or fully dark) draws nothing, so its objects cut nothing.
    if (camera && regionOpacity(camera.fadeEffect as unknown as FadeLike, camera.alpha) <= 0) continue;
    const view = { x: 0, y: 0, width: camera?.width ?? region.width, height: camera?.height ?? region.height };
    boxes.push(...drawnChromeBoxes(scene.children.list as unknown as DrawnObject[], view));
  }
  return boxes;
}

/**
 * Re-dispatches a mouse moving over `source` as a `mousemove` on `target` (the canvas), at the same client
 * coordinates. A touch or a pen is left alone. Returns the function that stops forwarding. `create` makes the event
 * (a test supplies its own where there is no `MouseEvent`).
 *
 * The cut-out of a card hover popover (`DomRegion.setHoles`) is not part of the panel, so a press or the wheel over the
 * popover reaches the canvas, not the list: it is drawn beside the pointer, never under it.
 */
export function forwardMouseMoves(
  source: EventTarget,
  target: EventTarget,
  create: (init: MouseEventInit) => Event = (init) => new MouseEvent("mousemove", init),
): () => void {
  const onMove = (event: Event): void => {
    const move = event as PointerEvent;
    if (move.pointerType !== "mouse") return;
    target.dispatchEvent(
      create({
        clientX: move.clientX,
        clientY: move.clientY,
        screenX: move.screenX,
        screenY: move.screenY,
        buttons: move.buttons,
      }),
    );
  };
  source.addEventListener("pointermove", onMove);
  return () => source.removeEventListener("pointermove", onMove);
}

/**
 * The panel events that act on the game or the settings (a slider drag included): stopped at the region while its scene
 * isn't the one taking input. A text field's own events are among them (`mc-input`, a late `compositionend` included):
 * a field that kept the caret when a modal opened over it must not change the scene's state.
 */
export const GUARDED_EVENTS = [
  "mc-activate",
  "mc-inspect",
  "mc-slide",
  "mc-step",
  "mc-search",
  "mc-submit",
  "mc-info",
  "mc-sort",
  "mc-filter-sheet",
  "mc-input",
  "mc-field-focus",
  "mc-search-focus",
  "mc-tile-focus",
  // A rebuilt page's own events (`mc-<feature>`: one name per feature, listed here) and its card pictures' Inspect.
  "mc-setup",
  "mc-card-inspect",
] as const;

/** The guarded events that say the caret went into or left a field: its leaving (`focused: false`) always gets through, so the scene never keeps a stale "typing" flag. */
const FOCUS_EVENTS: ReadonlySet<string> = new Set(["mc-field-focus", "mc-search-focus"]);

/** Whether a guarded `event` is stopped, given whether the region takes events now. */
export function guardStops(event: Event, takes: boolean): boolean {
  if (takes) return false;
  if (FOCUS_EVENTS.has(event.type) && (event as CustomEvent<{ focused?: boolean }>).detail?.focused === false)
    return false;
  return true;
}

/** The element holding the caret now, through any shadow roots (a field inside a panel's component). */
function deepActiveElement(): HTMLElement | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return (active as HTMLElement | null) ?? null;
}

/** A panel field that can be put back to a text (`McSearchField`, `McTextField`). */
interface RestorableField extends HTMLElement {
  value: string;
  restoreValue(text: string): void;
}

const isRestorable = (node: unknown): node is RestorableField =>
  typeof (node as RestorableField | null)?.restoreValue === "function";

/**
 * The field an `mc-input` or `mc-search` came from: the field itself (`mc-input` is raised from it), or the one the
 * panel names in `detail.key` (`mc-sheet` raises a field's `mc-search` again, keyed).
 */
function fieldOf(event: Event): RestorableField | null {
  const first = event.composedPath()[0];
  if (isRestorable(first)) return first;
  const key = (event as CustomEvent<{ key?: string }>).detail?.key;
  const sheet = event.target as { elementOf?: (key: string) => Element | null } | null;
  const found = key !== undefined ? sheet?.elementOf?.(key) : null;
  return isRestorable(found) ? found : null;
}

/**
 * Guards `wrap` (a region's box): every guarded event is stopped in the capture phase while `takes()` says no, and a
 * field of the box that holds the caret then lets go of it, so a field that kept the caret under a modal takes no
 * more keys or composition. (The box is not made inert: a press must still land on it, not fall through to the panel
 * of a screen below.)
 *
 * A stopped edit never leaves the field showing text the screen did not take: the field is put back to the last text
 * the screen accepted (what an event it let through carried, else the `value` the screen handed the field), and what
 * was typed since is dropped. So the text on screen and the results the screen shows always agree.
 *
 * A screen hands a field the text it has accepted as its `value`, never the field's live draft (`McSearchField.text`):
 * a redraw that copies the draft in would make the unaccepted text the baseline this puts the field back to.
 *
 * Returns the function that applies the blur; call it each time the answer may have changed.
 */
export function guardRegion(wrap: HTMLElement, takes: () => boolean, destroyed: () => boolean): () => void {
  /** The text a field last handed the screen, with the `value` the screen had given it then (a screen that resets the field moves on). */
  const accepted = new WeakMap<RestorableField, { readonly text: string; readonly model: string }>();
  for (const name of GUARDED_EVENTS)
    wrap.addEventListener(
      name,
      (event) => {
        const stops = destroyed() || guardStops(event, takes());
        if (name === "mc-input" || name === "mc-search") {
          const field = fieldOf(event);
          if (field) {
            if (stops) {
              const last = accepted.get(field);
              field.restoreValue(last && last.model === field.value ? last.text : field.value);
            } else {
              const text = (event as CustomEvent<{ value: string }>).detail?.value;
              if (typeof text === "string") accepted.set(field, { text, model: field.value });
            }
          }
        }
        if (stops) event.stopPropagation();
      },
      true,
    );
  return () => {
    if (takes()) return;
    const active = document.activeElement;
    if (active && wrap.contains(active)) deepActiveElement()?.blur();
  };
}

/**
 * Whether a panel's guarded event may reach its scene: the scene takes presses (`sceneTakesPresses`) and its panel is
 * not covered by a scene drawn above it or hidden (`sceneLayerState`). A hold armed before another modal opened fires
 * on a timer, and a covered element keeps its bounding box, so this is read at the dispatch.
 */
export function regionTakesEvents(takesPresses: boolean, shown: boolean, hidden: boolean): boolean {
  return takesPresses && shown && !hidden;
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
  /** Whether the panel took input at the last sync (shown, and no scene above takes it away). */
  #inputOpen = false;
  #clip: string | null = null;
  #live: boolean | null = null;
  #hidden = false;
  /** Rects left out of the panel, or a function read each frame (a field that hides itself while covered). */
  #holes: readonly Rect[] | (() => readonly Rect[]) = [];
  #follow: Followed | null = null;
  #offset = "";
  #z = -1;
  #destroyed = false;
  readonly #overlay: boolean;
  readonly #shownUnder: ReadonlySet<string>;
  readonly #passive: boolean;

  /**
   * `overlay`: the scene draws its own scrim and panel in the DOM, over the scene under it (a pop-up). Panels under it
   * then stay shown, dimmed by its scrim, instead of hiding while it is up.
   *
   * `shownUnder`: keys of scenes that draw over only part of the screen (and not over this panel), so the panel stays
   * shown while they are up instead of hiding.
   *
   * `passive`: the panel only shows something over a screen (a token resting on a seat) and takes no press, so the
   * controls under it stay pressable.
   */
  constructor(
    scene: Phaser.Scene,
    element: E,
    rect: Rect,
    options: { readonly overlay?: boolean; readonly shownUnder?: readonly string[]; readonly passive?: boolean } = {},
  ) {
    this.#scene = scene;
    this.#shownUnder = new Set(options.shownUnder ?? []);
    this.#overlay = options.overlay ?? false;
    this.#passive = options.passive ?? false;
    if (this.#overlay) overlayScenes.add(scene.sys.settings.key);
    liveRegions.add(this);
    this.element = element;
    this.#rect = rect;
    this.#layer = uiLayer(scene.game);
    this.#wrap = document.createElement("div");
    this.#wrap.dataset.scene = scene.sys.settings.key;
    Object.assign(this.#wrap.style, {
      position: "absolute",
      pointerEvents: this.#passive ? "none" : "auto",
      opacity: "0",
    });
    this.#wrap.append(element);
    // Every panel's `mc-activate`, `mc-inspect`, `mc-slide`, `mc-step` (a card hold's timer fires it) and its fields'
    // `mc-input` are stopped here, before its scene hears them, while the scene isn't taking presses (stopped, paused,
    // input off for an exit) or its panel is covered by another modal: `pointer-events` follows the scene only at
    // `postupdate`, so a tap in that gap would otherwise still act. A field holding the caret lets go of it then (`guardRegion`).
    this.#applyInert = guardRegion(
      this.#wrap,
      () => this.#takesEvents(),
      () => this.#destroyed,
    );
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
  setHoles(rects: readonly Rect[] | (() => readonly Rect[])): void {
    this.#holes = rects;
    if (this.#overlay) {
      overlayHoles.set(this.#scene.sys.settings.key, rects);
      for (const region of liveRegions) region.resync();
    }
    this.#sync();
  }

  /**
   * Passes the mouse moving over the panel on to Phaser, as if it moved over the canvas: Phaser hears a mouse move on
   * the canvas only, which the panel covers. For a scene that shows a card hover popover over its panel
   * (`ui/card-hover-preview.ts`, which follows Phaser's pointer); a finger or pen is left alone.
   */
  forwardMouseMoves(onPress?: () => void): void {
    const off = forwardMouseMoves(this.#wrap, this.#scene.game.canvas);
    this.#scene.events.once("shutdown", off);
    // A tap on the panel never reaches Phaser's own pointer-down, so the card hover popover is told here that a press
    // began (it takes itself down and stays down for the card pressed).
    if (onPress) {
      this.#wrap.addEventListener(
        "pointerdown",
        (event) => {
          if (event.pointerType === "mouse") onPress();
        },
        true,
      );
    }
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

  /**
   * The part of an element that shows in the region's box: a tile scrolled half out of its list is aimed at where it can
   * be pressed, not at a centre that lies under the bar below the list. The whole box when none of it shows.
   */
  visibleRectOf(target: Element): Rect {
    const whole = gameRectOf(target, this.#layer);
    const x = Math.max(whole.x, this.#rect.x);
    const y = Math.max(whole.y, this.#rect.y);
    const right = Math.min(whole.x + whole.width, this.#rect.x + this.#rect.width);
    const bottom = Math.min(whole.y + whole.height, this.#rect.y + this.#rect.height);
    return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : whole;
  }

  /** Whether the scene and the panel's cover state let an event through right now (read live, not at the last frame). */
  #applyInert: () => void = () => undefined;

  #takesEvents(): boolean {
    return regionTakesEvents(
      sceneTakesPresses(this.#scene) && !sceneInputCovered(this.#scene, this.#shownUnder),
      sceneLayerState(this.#scene, this.#shownUnder).shown,
      this.#hidden,
    );
  }

  /** Re-reads the scenes' state now (another region's holes changed). */
  resync(): void {
    this.#sync();
  }

  #sync(): void {
    if (this.#destroyed) return;
    const state = sceneLayerState(this.#scene, this.#shownUnder);
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
    // Input lost (covered, or a pop-up above that leaves the panel drawn) or hidden: a press-and-hold being timed must
    // not fire an Inspect from under the modal, nor a tap armed before it opened release into the panel.
    const inputOpen = shown && !sceneInputCovered(this.#scene, this.#shownUnder);
    if (this.#inputOpen && !inputOpen) {
      (this.element as { cancelHolds?: () => void }).cancelHolds?.();
      cancelPressesWithin(this.element);
    }
    this.#inputOpen = inputOpen;
    if (Math.abs(opacity - this.#opacity) > 0.001) {
      this.#opacity = opacity;
      this.#wrap.style.opacity = String(opacity);
    }
    // Presses follow the scene's own input: an overlay playing its exit turns its input off (`exitOverlay`), and its
    // panel stops taking taps with it.
    const scenes = this.#scene.game.scene.scenes.map((other) => ({ key: other.sys.settings.key }));
    const z = panelZIndex(scenes, this.#scene.sys.settings.key);
    if (z !== this.#z) {
      this.#z = z;
      this.#wrap.style.zIndex = z > 0 ? String(z) : "";
    }
    const live = this.#scene.input?.enabled !== false;
    if (live !== this.#live) {
      this.#live = live;
      this.#wrap.style.pointerEvents = live && !this.#passive ? "auto" : "none";
    }
    this.#applyInert();
    const clip = shown
      ? clipWithHoles(this.#rect, [
          ...chromeBoxes(this.#scene.game, this.#rect, this.#scene.sys.settings.key),
          ...(typeof this.#holes === "function" ? this.#holes() : this.#holes),
          ...holesAbove(scenes, this.#scene.sys.settings.key),
        ])
      : null;
    if (clip !== this.#clip) {
      this.#clip = clip;
      this.#wrap.style.clipPath = clip ?? "";
    }
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    liveRegions.delete(this);
    if (this.#overlay) {
      overlayScenes.delete(this.#scene.sys.settings.key);
      overlayHoles.delete(this.#scene.sys.settings.key);
      for (const region of liveRegions) region.resync();
    }
    this.#scene.events.off("postupdate", this.#sync, this);
    for (const event of STATE_EVENTS) this.#scene.events.off(event, this.#sync, this);
    this.#scene.events.off("shutdown", this.destroy, this);
    this.#scene.events.off("destroy", this.destroy, this);
    this.#wrap.remove();
  }
}
