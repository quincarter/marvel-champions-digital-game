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
 * on after), as the Report panel does, so the Escape or tap that closes it never reaches the screen under it.
 *
 * The scene mounts `mc-language-menu` (`@mc/ui`) as an overlay region over the screen under it, sets its model and
 * handles its `mc-activate`; the element draws the list or the note.
 */
import Phaser from "phaser";
import { artLanguageNow } from "../art/art-source.js";
import type { CardLanguage } from "../art/card-language.js";
import { ActivationGate } from "../dom/activation-gate.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { renderDeep } from "../dom/element-render.js";
import { focusStopsOf } from "../dom/element-stops.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { surface } from "../tokens.js";
import { onTap } from "../ui/tap.js";
import type { Rect } from "../view/layout.js";
import { languageMenuModelOf } from "../view/language-menu-model.js";
import { openExternal } from "../platform/platform.js";
import { DOWNLOADS_URL, WEB_VERSION_URL, type LanguagePopupMode } from "../view/language-button.js";
import { appSession } from "../session.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";

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
  #mounted: MountedElement<HTMLElementTagNameMap["mc-language-menu"]> | null = null;
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
    // Under the panel Phaser still hit-tests a press: this zone keeps it from reaching the screen under, and answers a
    // tap on the language button itself (a hole in the panel, whose own scene this one switched off) as "close".
    const { width, height } = this.scale.gameSize;
    const shield = this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    onTap(
      shield,
      (pointer) => {
        const a = this.#anchor;
        if (pointer.x >= a.x && pointer.x <= a.x + a.width && pointer.y >= a.y && pointer.y <= a.y + a.height)
          this.scene.stop();
      },
      "language-popup-outside",
    );
    const mounted = mountElement(this, "mc-language-menu", { x: 0, y: 0, width, height }, { overlay: true });
    this.#mounted = mounted;
    const gate = new ActivationGate(this);
    mounted.element.addEventListener("mc-activate", (event) => {
      const { key } = (event as CustomEvent<{ key: string }>).detail;
      if (!gate.take()) return;
      this.#press(key);
    });
    this.#route = new FocusRoute(this, { ring: domFocusRing, onCancel: () => this.scene.stop() });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gate.destroy();
      this.scale.off("resize", onResize, this);
      this.#mounted = null;
      for (const { scene, pointer, keyboard } of this.#disabled) {
        if (!scene.sys.isActive()) continue;
        if (pointer) scene.input.enabled = true;
        if (keyboard && scene.input.keyboard) scene.input.keyboard.enabled = true;
      }
      this.#disabled = [];
    });
    this.#draw();
  }

  #press(key: string): void {
    if (key === "outside" || key === "close") this.scene.stop();
    else if (key === "downloads") openExternal(DOWNLOADS_URL);
    else if (key === "web") openExternal(WEB_VERSION_URL);
    else this.#choose(key as CardLanguage);
  }

  #choose(language: CardLanguage): void {
    const session = appSession();
    if (session.settings.cardLanguage !== language) session.settings = { ...session.settings, cardLanguage: language };
    this.scene.stop();
  }

  #draw(): void {
    const mounted = this.#mounted;
    if (!mounted) return;
    const { region, element } = mounted;
    const { width, height } = this.scale.gameSize;
    region.setRect({ x: 0, y: 0, width, height });
    element.model = languageMenuModelOf(this.#mode, this.#anchor, { width, height }, artLanguageNow());
    void renderDeep(element).then(() => {
      if (this.#mounted !== mounted) return;
      const stops = focusStopsOf(element, (target) => region.rectOf(target));
      const order = this.#mode === "menu" ? [...stops.keys()] : ["downloads", "web", "close"];
      this.#route?.set(order, stops, this.#mode === "menu" ? surface.paper.hex : undefined);
      if (this.#focused) {
        this.#focused = false;
        this.#route?.focusKey(this.#mode === "menu" ? artLanguageNow() : "downloads");
      }
    });
  }
}
