/**
 * The keyboard and pad focus ring, drawn in the panel layer (`dom/ui-layer.ts`) for a screen whose content is a DOM
 * panel: a Phaser ring would be drawn under the panel. It looks like `McSelectionRing`'s focus ring: Hero Red, 3px,
 * `selectionRing.offset` outside the stop, a white edge under the red so it reads on a red button, and the faint red
 * glow outside that. A pulse (a prompt, not focus) fades as Phaser's does, unless motion is reduced.
 *
 * Pass `domFocusRing` as a `FocusRoute`'s `ring` (`scenes/focus-route.ts`).
 */
import type Phaser from "phaser";
import { accent, selectionRing } from "../tokens.js";
import type { FocusRing } from "../scenes/focus-route.js";
import type { Rect } from "../view/layout.js";
import { uiLayer } from "./ui-layer.js";

const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** The ring's box and look for a stop at `rect`, as plain data a test can read. */
export function ringStyle(rect: Rect, color: number = selectionRing.color.hex): Readonly<Record<string, string>> {
  const { offset, width, focusEdgeExtra } = selectionRing;
  // Phaser strokes centered on the ring's outer rect; a CSS border sits inside the box, so the box is grown by half.
  const half = width / 2;
  const edge = focusEdgeExtra / 2;
  const glow = `rgba(${(color >> 16) & 0xff}, ${(color >> 8) & 0xff}, ${color & 0xff}, ${accent.redGlowAlpha})`;
  return {
    left: `${rect.x - offset - half}px`,
    top: `${rect.y - offset - half}px`,
    width: `${rect.width + (offset + half) * 2}px`,
    height: `${rect.height + (offset + half) * 2}px`,
    border: `${width}px solid ${css(color)}`,
    boxShadow: `0 0 0 ${edge}px ${css(selectionRing.focusEdge)}, inset 0 0 0 ${edge}px ${css(selectionRing.focusEdge)}, 0 0 0 ${edge + 1.5}px ${glow}`,
  };
}

class DomFocusRing implements FocusRing {
  readonly #element: HTMLDivElement;
  readonly #color: number | undefined;

  constructor(scene: Phaser.Scene, color: number | undefined) {
    this.#color = color;
    this.#element = document.createElement("div");
    this.#element.className = "mc-focus-ring";
    Object.assign(this.#element.style, {
      position: "absolute",
      pointerEvents: "none",
      boxSizing: "border-box",
      zIndex: "10",
      display: "none",
    });
    uiLayer(scene.game).append(this.#element);
  }

  get graphics(): { readonly visible: boolean } {
    return { visible: this.#element.isConnected && this.#element.style.display !== "none" };
  }

  show(rect: Rect, mode: "static" | "pulse", reducedMotion: boolean): void {
    Object.assign(this.#element.style, ringStyle(rect, this.#color), { display: "block" });
    this.#element.style.animation =
      mode === "pulse" && !reducedMotion
        ? `mc-ring-pulse ${selectionRing.pulseMs}ms ease-in-out infinite alternate`
        : "none";
  }

  hide(): void {
    this.#element.style.display = "none";
  }

  destroy(): void {
    this.#element.remove();
  }
}

let keyframesAdded = false;

/** A `FocusRoute` `ring` for a screen whose stops are on a DOM panel. */
export function domFocusRing(scene: Phaser.Scene, color: number | undefined): FocusRing {
  if (!keyframesAdded) {
    keyframesAdded = true;
    const style = document.createElement("style");
    style.textContent = "@keyframes mc-ring-pulse { from { opacity: 1; } to { opacity: 0.45; } }";
    document.head.append(style);
  }
  return new DomFocusRing(scene, color);
}
