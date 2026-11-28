/**
 * What the card language button opens (#337, `scenes/language-button.ts`), over whatever screen is up.
 *
 * `menu` (the web, where the bundle carries every language): a short list under the button, one row per language by its
 * own name, the current one marked with a check. Choosing a row sets `Settings.cardLanguage`, which every screen's card
 * art follows (`session.ts`), and closes it.
 *
 * `info` (a native install, which carries one language): "Other languages". Which languages exist, which one this
 * install's art is in, why each is its own download, and two links that open the real browser: the downloads page and
 * the browser version that has every language.
 *
 * Tapping outside, the close button or Escape closes either. While it is up every other scene's input is off (and back
 * on after), as the Report panel does, so the Escape or tap that closes it never reaches the screen under it. Unlike the
 * decision sheets it has no PEEK AT TABLE or Expand: it is a note and a list, not a view that hides the table.
 *
 * It is a Lit panel over the canvas (`dom/popup-sheet.ts`, an overlay region), so a screen under it that is a Lit
 * panel too (Title's menu) stays shown beneath its scrim instead of hiding. The scene keeps the press shield, the
 * focus route and the choice.
 */
import Phaser from "phaser";
import { CARD_LANGUAGE_NAMES, availableCardLanguages, type CardLanguage } from "../art/card-language.js";
import { artLanguageNow } from "../art/art-source.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { t } from "../i18n/translate.js";
import { hit, ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { onTap } from "../ui/tap.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import {
  DOWNLOADS_URL,
  WEB_VERSION_URL,
  languageMenuLayout,
  languageRowLabel,
  otherLanguagesParagraphs,
  type LanguagePopupMode,
} from "../view/language-button.js";
import { openExternal } from "../platform/platform.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 12 };
const ROW_TYPE: TypeSpec = { ...typeRole.label, size: 13 };
/** A dropdown has no slide of its own (it hangs from the button), so its panel only appears. */
const STILL = { x: 0, y: 0, alpha: 1, active: true } as const;

export interface LanguagePopupData {
  readonly mode: LanguagePopupMode;
  /** The language button, which the list hangs from. */
  readonly anchor: Rect;
  /** Opened by pad or keyboard: focus starts on the current language (or the note's first link), ready to press. */
  readonly focused?: boolean;
}

export class LanguagePopupOverlay extends Phaser.Scene {
  #mode: LanguagePopupMode = "menu";
  #anchor: Rect = { x: 0, y: 0, width: 56, height: 34 };
  #focused = false;
  #route: FocusRoute | null = null;
  /** The list's or note's box this draw. */
  #box: Rect | null = null;
  #panel!: PopupSheet;
  /** What each button does this draw, by key. */
  #actions = new Map<string, () => void>();
  #disabled: { readonly scene: Phaser.Scene; readonly pointer: boolean; readonly keyboard: boolean }[] = [];

  constructor() {
    super(SCENES.languagePopup);
  }

  init(data: Partial<LanguagePopupData>): void {
    this.#mode = data.mode ?? "menu";
    if (data.anchor) this.#anchor = data.anchor;
    this.#focused = data.focused ?? false;
  }

  create(): void {
    this.#disabled = this.scene.manager
      .getScenes(true)
      .filter((scene) => scene !== this && scene.input)
      .map((scene) => ({ scene, pointer: scene.input.enabled, keyboard: scene.input.keyboard?.enabled === true }))
      .filter(({ pointer, keyboard }) => pointer || keyboard);
    for (const { scene, pointer, keyboard } of this.#disabled) {
      if (pointer) scene.input.enabled = false;
      if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = false;
    }
    this.#panel = new PopupSheet(this, (key) => this.#actions.get(key)?.());
    this.#panel.follow(STILL);
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { ring: domFocusRing, onCancel: () => this.#close() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const { scene, pointer, keyboard } of this.#disabled) {
        if (!scene.sys.isActive()) continue;
        if (pointer) scene.input.enabled = true;
        if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = true;
      }
      this.#disabled = [];
    });
    this.#draw();
    if (this.#focused) this.#route?.focusKey(this.#mode === "menu" ? artLanguageNow() : "downloads");
  }

  #close(): void {
    this.#panel.close();
  }

  #choose(language: CardLanguage): void {
    const session = appSession();
    if (session.settings.cardLanguage !== language) session.settings = { ...session.settings, cardLanguage: language };
    this.#close();
  }

  #draw(): void {
    destroyChildren(this);
    this.#actions = new Map();
    const { width, height } = this.scale.gameSize;
    // Under the panel Phaser still hit-tests a press: this zone keeps it from reaching the screen under, and answers a
    // tap that lands in a hole the panel leaves (the language button itself) as "outside".
    const shield = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    onTap(
      shield,
      (pointer) => {
        // A press on the panel reaches Phaser too (its listeners are on the window): only one outside the list or note is
        // "outside", which is where the panel's holes are (the language button, which this scene's input switch-off covers).
        const box = this.#box;
        const inside =
          box !== null &&
          pointer.x >= box.x &&
          pointer.x <= box.x + box.width &&
          pointer.y >= box.y &&
          pointer.y <= box.y + box.height;
        if (!inside) this.#close();
      },
      "language-popup-outside",
    );
    if (this.#mode === "menu") this.#drawMenu(width, height);
    else this.#drawInfo(width, height);
  }

  #drawMenu(width: number, height: number): void {
    const languages = availableCardLanguages();
    const current = artLanguageNow();
    const b = this.#panel.begin(width, height, 0.25);
    const labelWidth = Math.max(...languages.map((language) => CARD_LANGUAGE_NAMES[language].length)) * 10;
    const { box, rows } = languageMenuLayout(this.#anchor, languages.length, { width, height }, hit.target, labelWidth);
    // A tap outside the list closes it; the list's own press area is laid over it, so a miss between rows is not "outside".
    this.#box = box;
    b.tap("outside", { x: 0, y: 0, width, height });
    this.#actions.set("outside", () => this.#close());
    b.box(box, { fill: surface.ink.hex, stroke: surface.paper.hex, strokeWidth: 2 });
    b.tap("list", box);
    const stops = new Map<string, FocusStop>();
    languages.forEach((language, index) => {
      const rect = rows[index]!;
      const choose = (): void => this.#choose(language);
      b.button({
        key: language,
        rect,
        label: languageRowLabel(language, current),
        look: "onInk",
        type: ROW_TYPE,
        selected: language === current,
      });
      this.#actions.set(language, choose);
      stops.set(language, { rect, activate: choose });
    });
    this.#panel.mount(b, width, height);
    this.#route?.set([...languages], stops, surface.paper.hex);
  }

  #drawInfo(width: number, height: number): void {
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone" || formFactor === "phoneLandscape";
    const b = this.#panel.begin(width, height, 0.72);
    const pad = phone ? 16 : 24;
    const boxWidth = Math.min(520, width - (phone ? 16 : 48));
    const innerWidth = boxWidth - pad * 2;
    const bodySize = phone ? 13 : 15;
    const closeSize = hit.target;
    const bodyOptions = { size: bodySize, lineSpacing: 3, wrapWidth: innerWidth };

    // Laid out from the box's own origin, then the whole box is centred.
    const title = t("language.info.title");
    const titleHeight = b.measure(title, typeRole.barTitle).height;
    const top = pad + closeSize + 8;
    let y = top;
    const paragraphs = otherLanguagesParagraphs(artLanguageNow()).map((paragraph) => {
      const at = y;
      y += b.measure(paragraph, typeRole.body, bodyOptions).height + 10;
      return { paragraph, at };
    });
    y += 4;
    const links = [
      { id: "downloads", label: t("language.info.downloads"), look: "primary" as const, url: DOWNLOADS_URL },
      { id: "web", label: t("language.info.web"), look: "secondary" as const, url: WEB_VERSION_URL },
    ];
    const linkTop = y;
    const boxHeight = y + links.length * hit.target + (links.length - 1) * 10 + pad;
    const box: Rect = {
      x: Math.round((width - boxWidth) / 2),
      y: Math.round(Math.max(8, (height - boxHeight) / 2)),
      width: boxWidth,
      height: boxHeight,
    };
    b.tap("outside", { x: 0, y: 0, width, height });
    this.#actions.set("outside", () => this.#close());
    this.#box = box;
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    b.tap("note", box);
    b.text(box.x + pad, box.y + pad + (closeSize - titleHeight) / 2, title, typeRole.barTitle, {
      color: surface.ink.hex,
    });
    b.box(
      { x: box.x + pad, y: box.y + top - 4, width: box.width - pad * 2, height: 2 },
      { fill: surface.ink.hex, fillAlpha: ink.meta },
    );
    for (const { paragraph, at } of paragraphs) {
      b.text(box.x + pad, box.y + at, paragraph, typeRole.body, {
        ...bodyOptions,
        color: surface.ink.hex,
        alpha: 0.92,
      });
    }
    const stops = new Map<string, FocusStop>();
    const close: Rect = {
      x: box.x + box.width - pad - closeSize + 8,
      y: box.y + pad - 8,
      width: closeSize,
      height: closeSize,
    };
    b.button({ key: "close", rect: close, label: "✕", look: "quiet", type: BUTTON_TYPE, aria: t("common.close") });
    this.#actions.set("close", () => this.#close());
    stops.set("close", { rect: close, activate: () => this.#close() });
    links.forEach((link, index) => {
      const rect: Rect = {
        x: box.x + pad,
        y: box.y + linkTop + index * (hit.target + 10),
        width: innerWidth,
        height: hit.target,
      };
      const open = (): void => openExternal(link.url);
      b.button({ key: link.id, rect, label: link.label, look: link.look, type: BUTTON_TYPE });
      this.#actions.set(link.id, open);
      stops.set(link.id, { rect, activate: open });
    });
    this.#panel.mount(b, width, height);
    this.#route?.set(["downloads", "web", "close"], stops);
  }
}
