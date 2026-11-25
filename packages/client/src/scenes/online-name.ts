/**
 * "Your name" for online play (issue #880): a small sheet with one text field and Continue, over the screen that needs
 * a name (Play online the first time a room is hosted or joined; Settings' "Online name" row to change it). The name
 * is saved through `setOnlineName` (trimmed, at most 24 characters) and handed back through `onDone`; Cancel leaves it
 * as it was. Modeled on `scenes/option-notice.ts` (scrim and box, the screen underneath takes no input).
 */
import Phaser from "phaser";
import { t } from "../i18n/translate.js";
import { onlineName, setOnlineName } from "../platform/room.js";
import { MAX_ONLINE_NAME_LENGTH, cleanOnlineName } from "../settings.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { textStyle } from "../ui/theme.js";
import { McButton, McTextInput } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { bindTextFieldEscape } from "./text-field-escape.js";

export interface OnlineNameData {
  /** Called with the saved name once the player continues. */
  readonly onDone: (name: string) => void;
  readonly onCancel?: () => void;
}

const buttonType = { ...typeRole.label, size: 13 };

export class OnlineNameOverlay extends Phaser.Scene {
  #data: OnlineNameData | null = null;
  #buttons: McButton[] = [];
  #input: McTextInput | null = null;
  #value = "";
  #problem = false;
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;
  #done = false;

  constructor() {
    super(SCENES.onlineName);
  }

  init(data: OnlineNameData): void {
    this.#data = data;
    this.#value = onlineName();
    this.#problem = false;
    this.#done = false;
  }

  create(): void {
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.#input?.focused ?? false,
      onCancel: () => this.#cancel(),
      primary: () => "continue",
    });
    bindTextFieldEscape(this, () => this.#input);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#hints.dispose();
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#input?.destroy();
      this.#input = null;
    });
    this.#draw();
    this.#input?.focus();
  }

  #cancel(): void {
    if (this.#done) return;
    this.#done = true;
    const data = this.#data;
    this.scene.stop();
    data?.onCancel?.();
  }

  #continue(): void {
    if (this.#done) return;
    const name = cleanOnlineName(this.#input?.value ?? this.#value);
    if (name === "") {
      this.#problem = true;
      this.#draw();
      return;
    }
    this.#done = true;
    const kept = setOnlineName(name);
    const data = this.#data;
    this.scene.stop();
    data?.onDone(kept);
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    if (this.#input) this.#value = this.#input.value;
    // The field is a DOM element that keeps its focus and caret across a redraw (a phone's keyboard opening resizes the
    // page, which redraws): lifted out of the sweep and laid out again, never rebuilt, or the keyboard would close at once.
    const kept = this.#input ? this.#input.gameObjects : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#hints.reset();

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);

    const boxWidth = Math.min(520, width - 32);
    const textWidth = boxWidth - 40;
    const ground = this.add.graphics();
    const title = this.add.text(0, 0, t("online.nameTitle"), textStyle(typeRole.barTitle, surface.ink.hex));
    const body = this.add
      .text(0, 0, t("online.nameBody"), textStyle(typeRole.body, surface.ink.hex, 0.9))
      .setWordWrapWidth(textWidth, true);
    const problem = this.#problem
      ? this.add
          .text(0, 0, t("online.nameEmpty"), textStyle(typeRole.rowTitle, surface.ink.hex))
          .setWordWrapWidth(textWidth, true)
      : null;
    const fieldHeight = hit.primary;
    const half = (textWidth - 12) / 2;
    const boxHeight =
      20 +
      title.height +
      8 +
      body.height +
      14 +
      fieldHeight +
      (problem ? problem.height + 8 : 0) +
      16 +
      hit.primary +
      20;
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
    const fieldRect: Rect = { x: box.x + 20, y: body.y + body.height + 14, width: textWidth, height: fieldHeight };
    problem?.setPosition(box.x + 20, fieldRect.y + fieldRect.height + 8);
    if (this.#input) {
      this.#input.layout(fieldRect);
      for (const node of this.#input.gameObjects) this.children.bringToTop(node);
    } else {
      this.#input = new McTextInput(this, {
        rect: fieldRect,
        value: this.#value,
        type: typeRole.body,
        placeholder: t("online.namePlaceholder"),
        maxLength: MAX_ONLINE_NAME_LENGTH,
        onChange: (value) => {
          this.#value = value;
        },
      });
      // Enter in the name field continues, as the Continue button does (the field's own handler only leaves the field).
      (this.#input.gameObject as unknown as { node: HTMLElement }).node.addEventListener("keydown", (event) => {
        // After this key press finishes: tearing the field down inside its own keydown left its DOM box on screen.
        if (event.key === "Enter") setTimeout(() => this.#continue(), 0);
      });
    }
    const buttonY = box.y + box.height - 20 - hit.primary;
    const cancelRect: Rect = { x: box.x + 20, y: buttonY, width: half, height: hit.primary };
    const goRect: Rect = { x: cancelRect.x + half + 12, y: buttonY, width: half, height: hit.primary };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: t("online.nameCancel"),
        type: buttonType,
        rect: cancelRect,
        onClick: () => this.#cancel(),
      }),
      new McButton(this, {
        kind: "primary",
        label: t("online.nameContinue"),
        type: buttonType,
        rect: goRect,
        onClick: () => this.#continue(),
      }),
    );
    this.#hints.button(this.#buttons[0]!, ["cancel"], "paper");
    const stops = new Map<string, FocusStop>([
      ["field", { rect: fieldRect, activate: () => this.#input?.focus() }],
      ["cancel", { rect: cancelRect, activate: () => this.#cancel() }],
      ["continue", { rect: goRect, activate: () => this.#continue() }],
    ]);
    this.#route?.set(["field", "cancel", "continue"], stops);
  }
}
