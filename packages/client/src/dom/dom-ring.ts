/**
 * The keyboard and pad focus ring, drawn in the panel layer (`dom/ui-layer.ts`) for a screen whose content is a DOM
 * panel: a Phaser ring would be drawn under the panel. It looks like `McSelectionRing`'s focus ring: Hero Red, 3px,
 * `selectionRing.offset` outside the stop, a white edge under the red so it reads on a red button, and the faint red
 * glow outside that. A pulse (a prompt, not focus) fades as Phaser's does, unless motion is reduced.
 *
 * Pass `domFocusRing` as a `FocusRoute`'s `ring` (`scenes/focus-route.ts`).
 */
import type Phaser from "phaser";
import { selectionRing } from "../tokens.js";
import type { FocusRing } from "../scenes/focus-route.js";
import type { Rect } from "../view/layout.js";
import { uiLayer } from "./ui-layer.js";
import { ringZIndex, sceneLayerState } from "./dom-region.js";

const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** The ring's box and look for a stop at `rect`, as plain data a test can read. */
export function ringStyle(rect: Rect, color: number = selectionRing.color.hex): Readonly<Record<string, string>> {
  const { offset, width, focusEdgeExtra } = selectionRing;
  // Phaser strokes centered on the ring's outer rect; a CSS border sits inside the box, so the box is grown by half.
  const half = width / 2;
  const edge = focusEdgeExtra / 2;
  const glow = `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${selectionRing.glowAlpha})`;
  return {
    left: `${rect.x - offset - half}px`,
    top: `${rect.y - offset - half}px`,
    width: `${rect.width + (offset + half) * 2}px`,
    height: `${rect.height + (offset + half) * 2}px`,
    border: `${width}px solid ${css(color)}`,
    boxShadow: `0 0 0 ${edge}px ${css(selectionRing.focusEdge)}, inset 0 0 0 ${edge}px ${css(selectionRing.focusEdge)}, 0 0 0 ${edge + 1.5}px ${glow}`,
  };
}

/** A pop-up's slide and fade (`dom/popup-sheet.ts`), which its focus ring moves and fades with. */
export const ringMotion = new WeakMap<Phaser.Scene, { readonly y: number; readonly alpha: number }>();

const STATE_EVENTS = ["postupdate", "sleep", "pause", "wake", "resume"] as const;

class DomFocusRing implements FocusRing {
  /** Outer wrapper: the box, display and the camera-fade opacity (`#sync`). The pulse never runs on it. */
  readonly #element: HTMLDivElement;
  /** Inner ring: the border and glow, and the only element the pulse animates, so a running CSS animation can't
   *  override the wrapper's inline opacity while the camera fades. */
  readonly #ring: HTMLDivElement;
  readonly #color: number | undefined;
  readonly #scene: Phaser.Scene;
  readonly #passes: ReadonlySet<string> | undefined;
  /** Shown by the route (`show`), as against hidden with its scene (an overlay above, a sleeping scene). */
  #wanted = false;

  constructor(scene: Phaser.Scene, color: number | undefined, passes?: ReadonlySet<string>) {
    this.#color = color;
    this.#passes = passes;
    this.#scene = scene;
    this.#element = document.createElement("div");
    this.#element.className = "mc-focus-ring";
    Object.assign(this.#element.style, {
      position: "absolute",
      pointerEvents: "none",
      boxSizing: "border-box",
      zIndex: "10",
      display: "none",
    });
    this.#ring = document.createElement("div");
    Object.assign(this.#ring.style, { position: "absolute", inset: "0", boxSizing: "border-box" });
    this.#element.append(this.#ring);
    uiLayer(scene.game).append(this.#element);
    // It shows, hides and fades with its scene, as the scene's panel does (`dom/dom-region.ts`), and goes with it.
    for (const event of STATE_EVENTS) scene.events.on(event, this.#sync, this);
    scene.events.once("shutdown", this.destroy, this);
    scene.events.once("destroy", this.destroy, this);
  }

  #sync(): void {
    const { shown, opacity } = sceneLayerState(this.#scene, this.#passes);
    this.#element.style.display = this.#wanted && shown ? "block" : "none";
    const moving = ringMotion.get(this.#scene);
    this.#element.style.opacity = String(opacity * (moving?.alpha ?? 1));
    this.#element.style.transform = moving && moving.y !== 0 ? `translateY(${moving.y}px)` : "";
    // Over its own scene's panel and under the panel of a scene drawn above (`panelZIndex`).
    const scenes = this.#scene.game.scene.scenes.map((other) => ({ key: other.sys.settings.key }));
    this.#element.style.zIndex = String(ringZIndex(scenes, this.#scene.sys.settings.key));
  }

  get graphics(): { readonly visible: boolean } {
    return { visible: this.#element.isConnected && this.#element.style.display !== "none" };
  }

  show(rect: Rect, mode: "static" | "pulse", reducedMotion: boolean): void {
    this.#wanted = true;
    const { left, top, width, height, ...look } = ringStyle(rect, this.#color);
    Object.assign(this.#element.style, { left, top, width, height });
    Object.assign(this.#ring.style, look);
    this.#sync();
    this.#ring.style.animation =
      mode === "pulse" && !reducedMotion
        ? `mc-ring-pulse ${selectionRing.pulseMs}ms ease-in-out infinite alternate`
        : "none";
  }

  hide(): void {
    this.#wanted = false;
    this.#element.style.display = "none";
  }

  destroy(): void {
    for (const event of STATE_EVENTS) this.#scene.events.off(event, this.#sync, this);
    this.#scene.events.off("shutdown", this.destroy, this);
    this.#scene.events.off("destroy", this.destroy, this);
    this.#element.remove();
  }
}

let keyframesAdded = false;

/**
 * A `FocusRoute` `ring` for a screen whose stops are on a DOM panel. `passes`: the scenes the ring stays shown under
 * (`DomRegion`'s `shownUnder`).
 */
export function domFocusRing(scene: Phaser.Scene, color: number | undefined, passes?: ReadonlySet<string>): FocusRing {
  if (!keyframesAdded) {
    keyframesAdded = true;
    const style = document.createElement("style");
    style.textContent = "@keyframes mc-ring-pulse { from { opacity: 1; } to { opacity: 0.45; } }";
    document.head.append(style);
  }
  return new DomFocusRing(scene, color, passes);
}
