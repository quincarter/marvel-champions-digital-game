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
 */
import Phaser from "phaser";
import { CARD_LANGUAGE_NAMES, availableCardLanguages, type CardLanguage } from "../art/card-language.js";
import { artLanguageNow } from "../art/art-source.js";
import { hit, ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
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

export interface LanguagePopupData {
  readonly mode: LanguagePopupMode;
  /** The language button, which the list hangs from. */
  readonly anchor: Rect;
}

export class LanguagePopupOverlay extends Phaser.Scene {
  #mode: LanguagePopupMode = "menu";
  #anchor: Rect = { x: 0, y: 0, width: 56, height: 34 };
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #disabled: { readonly scene: Phaser.Scene; readonly pointer: boolean; readonly keyboard: boolean }[] = [];

  constructor() {
    super(SCENES.languagePopup);
  }

  init(data: Partial<LanguagePopupData>): void {
    this.#mode = data.mode ?? "menu";
    if (data.anchor) this.#anchor = data.anchor;
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
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.scene.stop() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      for (const { scene, pointer, keyboard } of this.#disabled) {
        if (!scene.sys.isActive()) continue;
        if (pointer) scene.input.enabled = true;
        if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = true;
      }
      this.#disabled = [];
    });
    this.#draw();
  }

  #choose(language: CardLanguage): void {
    const session = appSession();
    if (session.settings.cardLanguage !== language) session.settings = { ...session.settings, cardLanguage: language };
    this.scene.stop();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const { width, height } = this.scale.gameSize;
    // Outside the list or note: a tap closes it, and keeps the press from reaching the screen under.
    const outside = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    onTap(outside, () => this.scene.stop(), "language-popup-outside");
    if (this.#mode === "menu") this.#drawMenu(width, height);
    else this.#drawInfo(width, height);
  }

  #drawMenu(width: number, height: number): void {
    const languages = availableCardLanguages();
    const current = artLanguageNow();
    this.add.graphics().fillStyle(surface.void.hex, 0.25).fillRect(0, 0, width, height);
    const labelWidth = Math.max(...languages.map((language) => CARD_LANGUAGE_NAMES[language].length)) * 10;
    const { box, rows } = languageMenuLayout(this.#anchor, languages.length, { width, height }, hit.target, labelWidth);
    const ground = this.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(2, surface.paper.hex, 1).strokeRect(box.x + 1, box.y + 1, box.width - 2, box.height - 2);
    // A press inside the list that misses a row is not "outside".
    this.add.zone(box.x, box.y, box.width, box.height).setOrigin(0, 0).setInteractive();
    const stops = new Map<string, FocusStop>();
    languages.forEach((language, index) => {
      const rect = rows[index]!;
      const choose = (): void => this.#choose(language);
      this.#buttons.push(
        new McButton(this, {
          kind: "onInk",
          label: languageRowLabel(language, current),
          type: ROW_TYPE,
          rect,
          selected: language === current,
          onClick: choose,
        }),
      );
      stops.set(language, { rect, activate: choose });
    });
    this.#route?.set([...languages], stops, surface.paper.hex);
  }

  #drawInfo(width: number, height: number): void {
    const formFactor = formFactorFor(width, height);
    const phone = formFactor === "phone" || formFactor === "phoneLandscape";
    this.add.graphics().fillStyle(surface.void.hex, 0.72).fillRect(0, 0, width, height);
    const pad = phone ? 16 : 24;
    const boxWidth = Math.min(520, width - (phone ? 16 : 48));
    const innerWidth = boxWidth - pad * 2;
    const bodySize = phone ? 13 : 15;
    const closeSize = hit.target;
    const ground = this.add.graphics();

    // Laid out from a provisional origin, then the whole box is centred and the texts moved with it.
    const title = this.add.text(0, 0, "Other languages", textStyle(typeRole.barTitle, surface.ink.hex));
    title.setPosition(pad, pad + (closeSize - title.height) / 2);
    const top = pad + closeSize + 8;
    let y = top;
    for (const paragraph of otherLanguagesParagraphs(artLanguageNow())) {
      const body = this.add
        .text(pad, y, paragraph, textStyle(typeRole.body, surface.ink.hex, 0.92))
        .setFontSize(bodySize)
        .setLineSpacing(3)
        .setWordWrapWidth(innerWidth);
      y += body.height + 10;
    }
    y += 4;
    const links = [
      { id: "downloads", label: "Downloads ↗", kind: "primary" as const, url: DOWNLOADS_URL },
      { id: "web", label: "Play in the browser ↗", kind: "secondary" as const, url: WEB_VERSION_URL },
    ];
    const linkRects = links.map((link, index) => ({
      link,
      rect: { x: pad, y: y + index * (hit.target + 10), width: innerWidth, height: hit.target } satisfies Rect,
    }));
    const bottom = y + links.length * hit.target + (links.length - 1) * 10;
    const boxHeight = bottom + pad;
    const box: Rect = {
      x: Math.round((width - boxWidth) / 2),
      y: Math.round(Math.max(8, (height - boxHeight) / 2)),
      width: boxWidth,
      height: boxHeight,
    };
    for (const object of this.children.list) {
      if (object instanceof Phaser.GameObjects.Text) object.setPosition(object.x + box.x, object.y + box.y);
    }
    ground.fillStyle(surface.paper.hex, 1).fillRect(box.x, box.y, box.width, box.height);
    ground.lineStyle(4, surface.ink.hex, 1).strokeRect(box.x, box.y, box.width, box.height);
    ground
      .lineStyle(2, surface.ink.hex, ink.meta)
      .lineBetween(box.x + pad, box.y + top - 4, box.x + box.width - pad, box.y + top - 4);
    // Under the buttons and texts but above the outside zone: a press on the note itself is not "outside".
    this.add.zone(box.x, box.y, box.width, box.height).setOrigin(0, 0).setInteractive();

    const close: Rect = {
      x: box.x + box.width - pad - closeSize + 8,
      y: box.y + pad - 8,
      width: closeSize,
      height: closeSize,
    };
    const stops = new Map<string, FocusStop>();
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "✕",
        type: BUTTON_TYPE,
        rect: close,
        onClick: () => this.scene.stop(),
      }),
    );
    stops.set("close", { rect: close, activate: () => this.scene.stop() });
    for (const { link, rect } of linkRects) {
      const moved = { ...rect, x: rect.x + box.x, y: rect.y + box.y };
      const open = (): void => openExternal(link.url);
      this.#buttons.push(
        new McButton(this, { kind: link.kind, label: link.label, type: BUTTON_TYPE, rect: moved, onClick: open }),
      );
      stops.set(link.id, { rect: moved, activate: open });
    }
    this.#route?.set(["downloads", "web", "close"], stops);
  }
}
