/**
 * "Your name" for online play (issue #880): a small sheet with one text field and Continue, over the screen that needs
 * a name (Play online the first time a room is hosted or joined; Settings' "Online name" row to change it). The name
 * is saved through `setOnlineName` (trimmed, at most 24 characters) and handed back through `onDone`; Cancel leaves it
 * as it was. Modeled on `scenes/option-notice.ts` (scrim and box, the screen underneath takes no input).
 *
 * The box is a Lit panel over the canvas (`dom/popup-sheet.ts`); the name field stays a Phaser `McTextInput`, seen
 * through a hole in the panel.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { onlineName, setOnlineName } from "../platform/room.js";
import { MAX_ONLINE_NAME_LENGTH, cleanOnlineName } from "../settings.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { McTextInput } from "../ui/widgets.js";
import { glyphsFitFormFactor } from "../view/glyph-placement.js";
import { formFactorFor, type Rect } from "../view/layout.js";
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
  #input: McTextInput | null = null;
  #value = "";
  #problem = false;
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  #glyphs!: SheetGlyphs;
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
    this.#panel = new PopupSheet(this, (key) => {
      if (key === "cancel") this.#cancel();
      else if (key === "continue") this.#continue();
    });
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#input?.focused ?? false,
      onCancel: () => this.#cancel(),
      primary: () => "continue",
    });
    bindTextFieldEscape(this, () => this.#input);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#glyphs.dispose();
      this.scale.off("resize", onResize, this);
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
    if (this.#input) this.#value = this.#input.value;
    // The field is a DOM element that keeps its focus and caret across a redraw (a phone's keyboard opening resizes the
    // page, which redraws): lifted out of the sweep and laid out again, never rebuilt, or the keyboard would close at once.
    const kept = this.#input ? this.#input.gameObjects : [];
    for (const node of kept) this.children.remove(node);
    destroyChildren(this);
    for (const node of kept) this.children.add(node);
    this.#glyphs.reset();

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);

    const boxWidth = Math.min(520, width - 32);
    const textWidth = boxWidth - 40;
    const titleSpec = typeRole.barTitle;
    const bodySpec = typeRole.body;
    const wrapped = { wrapWidth: textWidth };
    const titleSize = b.measure(t("online.nameTitle"), titleSpec);
    const bodySize = b.measure(t("online.nameBody"), bodySpec, wrapped);
    const problemSize = this.#problem ? b.measure(t("online.nameEmpty"), typeRole.rowTitle, wrapped) : null;
    const fieldHeight = hit.primary;
    const half = (textWidth - 12) / 2;
    const boxHeight =
      20 +
      titleSize.height +
      8 +
      bodySize.height +
      14 +
      fieldHeight +
      (problemSize ? problemSize.height + 8 : 0) +
      16 +
      hit.primary +
      20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(16, (height - boxHeight) / 3),
      width: boxWidth,
      height: boxHeight,
    };
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    const titleY = box.y + 20;
    b.text(box.x + 20, titleY, t("online.nameTitle"), titleSpec, { color: surface.ink.hex });
    const bodyY = titleY + titleSize.height + 8;
    b.text(box.x + 20, bodyY, t("online.nameBody"), bodySpec, { ...wrapped, color: surface.ink.hex, alpha: 0.9 });
    const fieldRect: Rect = { x: box.x + 20, y: bodyY + bodySize.height + 14, width: textWidth, height: fieldHeight };
    if (problemSize) {
      b.text(box.x + 20, fieldRect.y + fieldRect.height + 8, t("online.nameEmpty"), typeRole.rowTitle, {
        ...wrapped,
        color: surface.ink.hex,
      });
    }
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
    // Glyphs are for desktop and tablet landscape (`glyphsFitFormFactor`), as on every other screen.
    const glyphsFit = glyphsFitFormFactor(formFactorFor(width, height));
    this.#glyphs.button(b, {
      key: "cancel",
      rect: cancelRect,
      label: t("online.nameCancel"),
      look: "secondary",
      type: buttonType,
      ids: glyphsFit ? ["cancel"] : [],
      ground: "paper",
    });
    b.button({ key: "continue", rect: goRect, label: t("online.nameContinue"), look: "primary", type: buttonType });
    // The field is a Phaser DOM element under the panel: left out of it, it is seen and pressed.
    this.#panel.mount(b, width, height, [fieldRect]);
    const stops = new Map<string, FocusStop>([
      ["field", { rect: fieldRect, activate: () => this.#input?.focus() }],
      ["cancel", { rect: cancelRect, activate: () => this.#cancel() }],
      ["continue", { rect: goRect, activate: () => this.#continue() }],
    ]);
    this.#route?.set(["field", "cancel", "continue"], stops);
  }
}
