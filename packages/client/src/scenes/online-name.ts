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
import { surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { McTextInput } from "../ui/widgets.js";
import { glyphsFitFormFactor } from "../view/glyph-placement.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { layoutNameSheet } from "../view/online-name-layout.js";
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
    this.#panel = new PopupSheet(
      this,
      (key) => {
        if (key === "cancel") this.#cancel();
        else if (key === "continue") this.#continue();
      },
      undefined,
      { onDismiss: () => this.#cancel(), onSlide: (dy) => this.#input?.slide(dy) },
    );
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
    this.#panel.close(() => {
      this.scene.stop();
      data?.onCancel?.();
    });
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
    this.#panel.close(() => {
      this.scene.stop();
      data?.onDone(kept);
    });
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

    const titleSpec = typeRole.barTitle;
    const bodySpec = typeRole.body;
    const problemSpec = typeRole.rowTitle;
    // The sheet fits the viewport (`view/online-name-layout.ts`): measured at the roomy width first, again at the compact
    // one when the roomy layout does not fit, which only ever makes the text shorter.
    const measured = (innerWidth: number) => {
      const wrapped = { wrapWidth: innerWidth };
      return {
        titleHeight: b.measure(t("online.nameTitle"), titleSpec).height,
        bodyHeight: b.measure(t("online.nameBody"), bodySpec, wrapped).height,
        problemHeight: this.#problem ? b.measure(t("online.nameEmpty"), problemSpec, wrapped).height : null,
      };
    };
    let sheet = layoutNameSheet({ width, height, ...measured(Math.min(520, width - 32) - 40) });
    if (sheet.compact) sheet = layoutNameSheet({ width, height, ...measured(sheet.box.width - 2 * sheet.pad) });
    const { box, pad, fieldRect } = sheet;
    const textWidth = box.width - 2 * pad;
    const wrapped = { wrapWidth: textWidth };
    const half = (textWidth - 12) / 2;
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    b.text(box.x + pad, sheet.titleY, t("online.nameTitle"), titleSpec, { color: surface.ink.hex });
    if (sheet.body.rect.height > 0) {
      const bodyOptions = { ...wrapped, color: surface.ink.hex, alpha: 0.9 };
      if (sheet.body.scrolls) {
        // A short viewport: the explanation scrolls in its own region, the field and buttons stay put.
        b.scroll("name-body", sheet.body.rect, sheet.body.contentHeight, (inner) => {
          inner.text(box.x + pad, 0, t("online.nameBody"), bodySpec, bodyOptions);
        });
      } else {
        b.text(box.x + pad, sheet.body.rect.y, t("online.nameBody"), bodySpec, bodyOptions);
      }
    }
    if (sheet.problemY !== null) {
      b.text(box.x + pad, sheet.problemY, t("online.nameEmpty"), problemSpec, { ...wrapped, color: surface.ink.hex });
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
    const cancelRect: Rect = { x: box.x + pad, y: sheet.buttonY, width: half, height: sheet.buttonHeight };
    const goRect: Rect = { x: cancelRect.x + half + 12, y: sheet.buttonY, width: half, height: sheet.buttonHeight };
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
