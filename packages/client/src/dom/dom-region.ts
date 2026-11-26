/**
 * A Lit panel (`@mc/ui`) mounted for one Phaser scene, at a layout `Rect`, in the panel layer over the canvas
 * (`dom/ui-layer.ts`). The scene keeps everything else: its own chrome (top bar, Back, glyph hints), navigation,
 * focus route and store subscriptions. The panel only shows what the scene hands it.
 *
 * The region follows its scene, so the two read as one screen:
 * - it is removed when the scene shuts down, and hidden while the scene sleeps or is hidden;
 * - it fades with the scene's camera (`fadeScreenIn`, `goToScreen`'s fade-out, a held entrance), since a camera fade
 *   only darkens the canvas;
 * - it hides while a scene drawn above this one is up (an overlay), since the DOM always sits over the canvas and
 *   would otherwise cover it. Chrome scenes (`CHROME_SCENES`: the corner buttons and toasts) don't count.
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

export class DomRegion<E extends HTMLElement = HTMLElement> {
  readonly element: E;
  readonly #scene: Phaser.Scene;
  readonly #wrap: HTMLDivElement;
  #rect: Rect;
  #opacity = -1;
  #shown: boolean | null = null;
  #destroyed = false;

  constructor(scene: Phaser.Scene, element: E, rect: Rect) {
    this.#scene = scene;
    this.element = element;
    this.#rect = rect;
    this.#wrap = document.createElement("div");
    this.#wrap.dataset.scene = scene.sys.settings.key;
    Object.assign(this.#wrap.style, { position: "absolute", pointerEvents: "auto", opacity: "0" });
    this.#wrap.append(element);
    uiLayer(scene.game).append(this.#wrap);
    this.setRect(rect);
    this.#sync();
    scene.events.on("postupdate", this.#sync, this);
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

  /** The region's box, in game coordinates (what a focus stop's `view` is). */
  get rect(): Rect {
    return this.#rect;
  }

  /** An element inside the panel, in game coordinates: its box relative to the layer the region sits in. */
  rectOf(target: Element): Rect {
    const box = target.getBoundingClientRect();
    const origin = this.#wrap.parentElement?.getBoundingClientRect();
    return { x: box.left - (origin?.left ?? 0), y: box.top - (origin?.top ?? 0), width: box.width, height: box.height };
  }

  #sync(): void {
    if (this.#destroyed) return;
    const settings = this.#scene.sys.settings;
    const scenes: SceneLike[] = this.#scene.game.scene.scenes.map((scene) => ({
      key: scene.sys.settings.key,
      active: scene.sys.isActive(),
      visible: scene.sys.settings.visible,
    }));
    const shown =
      settings.visible && !this.#scene.sys.isSleeping() && !coveredAbove(scenes, settings.key, CHROME_SCENES);
    if (shown !== this.#shown) {
      this.#shown = shown;
      this.#wrap.style.visibility = shown ? "visible" : "hidden";
    }
    const camera = this.#scene.cameras?.main;
    const opacity = camera ? regionOpacity(camera.fadeEffect as unknown as FadeLike, camera.alpha) : 1;
    if (Math.abs(opacity - this.#opacity) > 0.001) {
      this.#opacity = opacity;
      this.#wrap.style.opacity = String(opacity);
    }
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#scene.events.off("postupdate", this.#sync, this);
    this.#scene.events.off("shutdown", this.destroy, this);
    this.#scene.events.off("destroy", this.destroy, this);
    this.#wrap.remove();
  }
}
