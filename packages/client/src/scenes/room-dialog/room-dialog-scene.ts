/**
 * The base of the three in-room pop-ups ("Ask for a change", "Give <hero> to...", the in-game chat): a scene that mounts one
 * dialog element (`components/room-dialogs/`) as an overlay region over the board, hears its typed `mc-room-dialog`
 * presses once per frame (`ActivationGate`), routes the pad and keyboard over the element's `data-stop` parts, and closes
 * on B, Escape or a tap on the scrim. A text field in the dialog is an `mc-text-field`: the scene keeps the accepted text
 * and puts it back (`restoreValue`) when it refuses an edit.
 */
import Phaser from "phaser";
import type { McTextField } from "@mc/ui";
import type { RoomDialogEvent } from "../../components/room-dialogs/room-dialogs.types.js";
import { ActivationGate } from "../../dom/activation-gate.js";
import { ControlGlyphs } from "../../dom/control-glyphs.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../../dom/element-region.js";
import { renderDeep } from "../../dom/element-render.js";
import { bindStopFocus, focusStopsOf } from "../../dom/element-stops.js";
import { FocusRoute } from "../focus-route.js";
import { bindTextFieldEscape } from "../text-field-escape.js";

export type RoomDialogTag = "mc-room-ask-dialog" | "mc-room-give-dialog" | "mc-room-chat-dialog";

/** What the scene reads of a dialog element besides its model. */
export interface RoomDialogElement extends HTMLElement {
  model: unknown;
  readonly scroller?: HTMLElement | null;
}

export abstract class RoomDialogScene<K extends RoomDialogTag> extends Phaser.Scene {
  protected dialog: MountedElement<HTMLElementTagNameMap[K]> | null = null;
  protected route: FocusRoute | null = null;
  protected glyphs: ControlGlyphs | null = null;
  /** The caret is in the dialog's text field: the route stands aside. */
  protected typing = false;

  /** Mounts `tag`; `press` hears each typed press (by stop key), `field` is the text field the dialog has, if any. */
  protected open(
    tag: K,
    options: {
      readonly press: (key: string) => void;
      readonly field?: () => McTextField | null;
      readonly primary?: string;
      readonly draw: () => void;
    },
  ): void {
    const { width, height } = this.scale.gameSize;
    // Swallows every press that lands on no control of this pop-up's own.
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const dialog = mountElement(this, tag, { x: 0, y: 0, width, height }, { overlay: true });
    this.dialog = dialog;
    const gate = new ActivationGate(this);
    const { element } = dialog;
    element.addEventListener("mc-room-dialog", (event) => {
      const { key } = (event as CustomEvent<RoomDialogEvent>).detail;
      if (gate.take()) options.press(key);
    });
    element.addEventListener("mc-dialog-dismiss", () => {
      if (gate.take()) this.close();
    });
    element.addEventListener("mc-field-focus", (event) => {
      this.typing = (event as CustomEvent<{ focused: boolean }>).detail.focused;
    });
    this.glyphs = new ControlGlyphs(this, () => options.draw());
    if (options.field) {
      const field = options.field;
      bindTextFieldEscape(this, () => {
        const f = field();
        return f ? { focused: f.isFocused, blur: () => f.blurInput() } : null;
      });
    }
    this.route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.typing,
      onCancel: () => this.close(),
      ...(options.primary ? { primary: () => options.primary! } : {}),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
      onPage: (direction) =>
        this.#scroller()?.scrollBy({ top: direction * (this.#scroller()?.clientHeight ?? 300) * 0.8 }),
    });
    const unbind = bindStopFocus(element, (key) => this.route?.focusKey(key));
    const onResize = (): void => options.draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gate.destroy();
      unbind();
      this.glyphs?.dispose();
      this.scale.off("resize", onResize, this);
      this.dialog = null;
    });
  }

  #scroller(): HTMLElement | null {
    return (this.dialog?.element as unknown as RoomDialogElement | undefined)?.scroller ?? null;
  }

  protected close(): void {
    this.scene.stop();
  }

  /** Sets the dialog's model and gives the route the stops once it has drawn. */
  protected show(model: unknown): void {
    const dialog = this.dialog;
    if (!dialog) return;
    const { width, height } = this.scale.gameSize;
    dialog.region.setRect({ x: 0, y: 0, width, height });
    (dialog.element as unknown as RoomDialogElement).model = model;
    void renderDeep(dialog.element).then(() => {
      if (this.dialog !== dialog) return;
      const stops = focusStopsOf(dialog.element, (target) => dialog.region.rectOf(target));
      this.route?.set([...stops.keys()], stops);
    });
  }
}
