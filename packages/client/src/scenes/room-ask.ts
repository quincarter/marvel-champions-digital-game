/**
 * "Ask for a change" (issue #881): a seated guest's request to the host, with a short note (at most 140 characters).
 * The host decides; the answer shows on the board as a prompt. Modeled on `scenes/online-name.ts`.
 */
import Phaser from "phaser";
import { t } from "../i18n/translate.js";
import { askHost } from "../platform/room.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { textStyle } from "../ui/theme.js";
import { McButton, McTextInput } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

export const MAX_ASK_NOTE = 140;
const buttonType = { ...typeRole.label, size: 13 };

export class RoomAskOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #input: McTextInput | null = null;
  #value = "";
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.roomAsk);
  }

  init(): void {
    this.#value = "";
  }

  create(): void {
    this.#route = new FocusRoute(this, {
      blocked: () => this.#input?.focused ?? false,
      onCancel: () => this.scene.stop(),
      primary: () => "send",
    });
    bindTextFieldEscape(this, () => this.#input);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#input?.destroy();
      this.#input = null;
    });
    this.#draw();
    this.#input?.focus();
  }

  #send(): void {
    askHost("adjust", (this.#input?.value ?? this.#value).trim().slice(0, MAX_ASK_NOTE));
    this.scene.stop();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    if (this.#input) this.#value = this.#input.value;
    this.#input?.destroy();
    this.#input = null;
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const boxWidth = Math.min(520, width - 32);
    const textWidth = boxWidth - 40;
    const ground = this.add.graphics();
    const title = this.add.text(0, 0, t("ask.title"), textStyle(typeRole.barTitle, surface.ink.hex));
    const body = this.add
      .text(0, 0, t("ask.body"), textStyle(typeRole.body, surface.ink.hex, 0.9))
      .setWordWrapWidth(textWidth, true);
    const boxHeight = 20 + title.height + 8 + body.height + 14 + hit.primary + 16 + hit.primary + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(16, (height - boxHeight) / 3),
      width: boxWidth,
      height: boxHeight,
    };
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    title.setPosition(box.x + 20, box.y + 20);
    body.setPosition(box.x + 20, title.y + title.height + 8);
    const fieldRect: Rect = { x: box.x + 20, y: body.y + body.height + 14, width: textWidth, height: hit.primary };
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
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: t("ask.cancel"),
        type: buttonType,
        rect: cancelRect,
        onClick: () => this.scene.stop(),
      }),
      new McButton(this, {
        kind: "primary",
        label: t("ask.send"),
        type: buttonType,
        rect: sendRect,
        onClick: () => this.#send(),
      }),
    );
    const stops = new Map<string, FocusStop>([
      ["field", { rect: fieldRect, activate: () => this.#input?.focus() }],
      ["cancel", { rect: cancelRect, activate: () => this.scene.stop() }],
      ["send", { rect: sendRect, activate: () => this.#send() }],
    ]);
    this.#route?.set(["field", "cancel", "send"], stops);
  }
}
