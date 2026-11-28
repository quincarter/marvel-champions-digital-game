/**
 * The base of the deck builder's two pop-up sheets (the search cheat sheet and the pack and wave picker): a scene that
 * mounts one element as an overlay region over the builder, switches the builder's input off while it is up (and back on
 * after), and routes the pad and keyboard over the element's `data-stop` parts. The sheet's element says what was pressed
 * through the builder's one event, `mc-deck-builder`; B, Escape and a tap on the scrim close it.
 */
import Phaser from "phaser";
import type { DeckBuilderEventDetail } from "../../components/deck-builder/shared/deck-builder-events.types.js";
import { ActivationGate } from "../../dom/activation-gate.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../../dom/element-region.js";
import { renderDeep } from "../../dom/element-render.js";
import { focusStopsOf, bindStopFocus } from "../../dom/element-stops.js";
import { FocusRoute } from "../focus-route.js";

/** What a sheet's element offers the scene besides its model. */
export interface SheetElement extends HTMLElement {
  readonly scroller: HTMLElement | null;
  model: unknown;
}

const PAGE = 0.8;

export abstract class DeckBuilderSheetScene<K extends "mc-search-help" | "mc-pool-pick"> extends Phaser.Scene {
  protected sheet: MountedElement<HTMLElementTagNameMap[K]> | null = null;
  protected route: FocusRoute | null = null;
  #gate: ActivationGate | null = null;

  /** Mounts `tag`, and says what to do for each press (`handle`) and when the sheet closes (`onClose`). */
  protected openSheet(
    tag: K,
    fromKey: string,
    handle: (detail: DeckBuilderEventDetail) => void,
    onClose: () => void,
  ): void {
    const from = this.scene.get(fromKey);
    if (from) from.input.enabled = false;
    this.input.enabled = true;
    const { width, height } = this.scale.gameSize;
    // Swallows every press that lands on no control of this pop-up's own.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const sheet = mountElement(this, tag, { x: 0, y: 0, width, height }, { overlay: true });
    this.sheet = sheet;
    const gate = new ActivationGate(this);
    this.#gate = gate;
    sheet.element.addEventListener("mc-deck-builder", (event) => {
      if (gate.take()) handle(event.detail);
    });
    sheet.element.addEventListener("mc-dialog-dismiss", () => this.close());
    const unbind = bindStopFocus(sheet.element, (key) => this.route?.focusKey(key));
    this.route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.close(),
      onPage: (direction) =>
        this.#scroller()?.scrollBy({ top: direction * (this.#scroller()?.clientHeight ?? 300) * PAGE }),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
    });
    const onResize = (): void => this.redraw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gate.destroy();
      unbind();
      this.scale.off("resize", onResize, this);
      this.sheet = null;
      if (from) from.input.enabled = true;
      onClose();
    });
  }

  #scroller(): HTMLElement | null {
    return (this.sheet?.element as SheetElement | undefined)?.scroller ?? null;
  }

  close(): void {
    this.scene.stop();
  }

  /** Sets the sheet's model and gives the route the stops once it has drawn. */
  protected show(model: unknown): void {
    const sheet = this.sheet;
    if (!sheet) return;
    const { width, height } = this.scale.gameSize;
    sheet.region.setRect({ x: 0, y: 0, width, height });
    (sheet.element as SheetElement).model = model;
    void renderDeep(sheet.element).then(() => {
      if (this.sheet !== sheet) return;
      const stops = focusStopsOf(sheet.element, (target) => sheet.region.rectOf(target));
      this.route?.set([...stops.keys()], stops);
    });
  }

  /** Draws again (a resize, a press that changed the model). */
  protected abstract redraw(): void;

  /** The gate stays shut for the frame after a press: a second tap does not run twice. */
  get gate(): ActivationGate | null {
    return this.#gate;
  }
}
