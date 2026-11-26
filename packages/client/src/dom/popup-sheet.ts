/**
 * The panel of a small pop-up scene (the End turn confirm, Concede, Ask for a change, Room chat) as an `mc-sheet`
 * over the canvas: its dim scrim, its box, text and buttons are all DOM parts built at the layout rects the scene
 * always used, so the look is the Phaser one. The region is an `overlay` (`DomRegion`): the panel of the scene it
 * opens over (Pause) stays shown under the pop-up's scrim instead of hiding, and the pop-up stacks above it.
 *
 * The scene keeps its navigation, focus route (stops at the same rects, ring `domFocusRing`), its Phaser press shield
 * and any `McTextInput`, which it leaves a hole for (`mount`'s `holes`).
 */
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import type Phaser from "phaser";
import { surface } from "../tokens.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { DomRegion, renderNow } from "./dom-region.js";
import { SheetBuilder } from "./sheet-builder.js";
import type { Rect } from "../view/layout.js";

export class PopupSheet {
  readonly #scene: Phaser.Scene;
  readonly #onActivate: (key: string) => void;
  #region: DomRegion<McSheet> | null = null;

  /** `onActivate` hears a button's key when it is tapped. */
  constructor(scene: Phaser.Scene, onActivate: (key: string) => void) {
    this.#scene = scene;
    this.#onActivate = onActivate;
    scene.events.once("shutdown", () => {
      this.#region = null;
    });
  }

  /** The panel element once mounted (to reach a part, e.g. to scroll a region). */
  get element(): McSheet | null {
    return this.#region?.element ?? null;
  }

  /** A builder over the whole screen, with the dim scrim (Phaser's `void` at 0.7) already laid. */
  begin(width: number, height: number): SheetBuilder {
    const builder = new SheetBuilder(this.#scene.game, { x: 0, y: 0 }, isDesktopType);
    builder.box({ x: 0, y: 0, width, height }, { fill: surface.void.hex, fillAlpha: 0.7 });
    return builder;
  }

  /** Hands the built parts to the panel (made on first use) and renders them now, so stops can be read this frame. */
  mount(builder: SheetBuilder, width: number, height: number, holes: readonly Rect[] = []): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#onActivate((event as CustomEvent<{ key: string }>).detail.key);
      });
      this.#region = new DomRegion(this.#scene, element, { x: 0, y: 0, width, height }, { overlay: true });
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    region.setHoles(holes);
    region.element.nodes = builder.nodes;
    renderNow(region.element);
  }
}
