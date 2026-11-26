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
import { ActivationGate } from "./activation-gate.js";
import { DomRegion, renderNow } from "./dom-region.js";
import { SheetBuilder } from "./sheet-builder.js";
import type { Rect } from "../view/layout.js";

export class PopupSheet {
  readonly #scene: Phaser.Scene;
  readonly #onActivate: (key: string) => void;
  readonly #onHover: ((key: string, over: boolean) => void) | undefined;
  #region: DomRegion<McSheet> | null = null;
  /** One activation a frame, none once the scene stops or turns its input off (a second Send/Concede/Confirm tap). */
  readonly #gate: ActivationGate;

  /** `onActivate` hears a button's key when it is tapped; `onHover`, a mouse moving onto or off a tracked tap area. */
  constructor(scene: Phaser.Scene, onActivate: (key: string) => void, onHover?: (key: string, over: boolean) => void) {
    this.#scene = scene;
    this.#onActivate = onActivate;
    this.#onHover = onHover;
    this.#gate = new ActivationGate(scene);
    scene.events.once("shutdown", () => {
      this.#gate.destroy();
      this.#region = null;
    });
  }

  /** The panel element once mounted (to reach a part, e.g. to scroll a region). */
  get element(): McSheet | null {
    return this.#region?.element ?? null;
  }

  /** A builder over the whole screen, with the dim scrim (Phaser's `void`, at 0.7 unless `scrim` says) already laid. */
  begin(width: number, height: number, scrim = 0.7): SheetBuilder {
    const builder = new SheetBuilder(this.#scene.game, { x: 0, y: 0 }, isDesktopType);
    builder.box({ x: 0, y: 0, width, height }, { fill: surface.void.hex, fillAlpha: scrim });
    return builder;
  }

  /** Hands the built parts to the panel (made on first use) and renders them now, so stops can be read this frame. */
  mount(builder: SheetBuilder, width: number, height: number, holes: readonly Rect[] = []): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        if (!this.#gate.take()) return;
        this.#onActivate((event as CustomEvent<{ key: string }>).detail.key);
      });
      if (this.#onHover) {
        element.addEventListener("mc-hover", (event) => {
          const { key, over } = (event as CustomEvent<{ key: string; over: boolean }>).detail;
          this.#onHover?.(key, over);
        });
      }
      this.#region = new DomRegion(this.#scene, element, { x: 0, y: 0, width, height }, { overlay: true });
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    region.setHoles(holes);
    region.element.nodes = builder.nodes;
    renderNow(region.element);
  }
}
