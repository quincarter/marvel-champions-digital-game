/**
 * "Ask for a change" (issue #881): a seated guest's request to the host, with a short note (at most 140 characters).
 * The host decides; the answer shows on the board as a prompt. Modeled on `scenes/online-name.ts`.
 *
 * The box is a Lit panel over the canvas (`dom/popup-sheet.ts`); the note field stays a Phaser `McTextInput`, seen
 * through a hole in the panel.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { t } from "../i18n/translate.js";
import { askHost } from "../platform/room.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { McTextInput } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

export const MAX_ASK_NOTE = 140;
const buttonType = { ...typeRole.label, size: 13 };

export class RoomAskOverlay extends Phaser.Scene {
  #input: McTextInput | null = null;
  #value = "";
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;

  constructor() {
    super(SCENES.roomAsk);
  }

  init(): void {
    this.#value = "";
  }

  create(): void {
    this.#panel = new PopupSheet(
      this,
      (key) => {
        if (key === "cancel") this.#stop();
        else if (key === "send") this.#send();
      },
      undefined,
      { onDismiss: () => this.#stop(), onSlide: (dy) => this.#input?.slide(dy) },
    );
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#input?.focused ?? false,
      onCancel: () => this.#stop(),
      primary: () => "send",
    });
    bindTextFieldEscape(this, () => this.#input);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#input?.destroy();
      this.#input = null;
    });
    this.#draw();
    this.#input?.focus();
  }

  #send(): void {
    askHost("adjust", (this.#input?.value ?? this.#value).trim().slice(0, MAX_ASK_NOTE));
    this.#stop();
  }

  /** Leaves with the pop-up's exit (`PopupSheet.close`). */
  #stop(): void {
    this.#panel.close(() => this.scene.stop());
  }

  #draw(): void {
    if (this.#input) this.#value = this.#input.value;
    this.#input?.destroy();
    this.#input = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);
    const boxWidth = Math.min(520, width - 32);
    const textWidth = boxWidth - 40;
    const titleSpec = typeRole.barTitle;
    const bodySpec = typeRole.body;
    const bodyOptions = { wrapWidth: textWidth };
    const titleSize = b.measure(t("ask.title"), titleSpec);
    const bodySize = b.measure(t("ask.body"), bodySpec, bodyOptions);
    const boxHeight = 20 + titleSize.height + 8 + bodySize.height + 14 + hit.primary + 16 + hit.primary + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(16, (height - boxHeight) / 3),
      width: boxWidth,
      height: boxHeight,
    };
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    b.text(box.x + 20, box.y + 20, t("ask.title"), titleSpec, { color: surface.ink.hex });
    const bodyY = box.y + 20 + titleSize.height + 8;
    b.text(box.x + 20, bodyY, t("ask.body"), bodySpec, { ...bodyOptions, color: surface.ink.hex, alpha: 0.9 });
    const fieldRect: Rect = { x: box.x + 20, y: bodyY + bodySize.height + 14, width: textWidth, height: hit.primary };
    this.#input = new McTextInput(this, {
      rect: fieldRect,
      value: this.#value,
      type: typeRole.body,
      placeholder: t("ask.placeholder"),
      maxLength: MAX_ASK_NOTE,
      onChange: (value) => {
        this.#value = value;
      },
    });
    const half = (textWidth - 12) / 2;
    const buttonY = box.y + box.height - 20 - hit.primary;
    const cancelRect: Rect = { x: box.x + 20, y: buttonY, width: half, height: hit.primary };
    const sendRect: Rect = { x: cancelRect.x + half + 12, y: buttonY, width: half, height: hit.primary };
    b.button({ key: "cancel", rect: cancelRect, label: t("ask.cancel"), look: "secondary", type: buttonType });
    b.button({ key: "send", rect: sendRect, label: t("ask.send"), look: "primary", type: buttonType });
    // The field is a Phaser DOM element under the panel: left out of it, it is seen and pressed.
    this.#panel.mount(b, width, height, [fieldRect]);
    const stops = new Map<string, FocusStop>([
      ["field", { rect: fieldRect, activate: () => this.#input?.focus() }],
      ["cancel", { rect: cancelRect, activate: () => this.#stop() }],
      ["send", { rect: sendRect, activate: () => this.#send() }],
    ]);
    this.#route?.set(["field", "cancel", "send"], stops);
  }
}
