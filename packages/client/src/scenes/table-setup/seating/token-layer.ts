/**
 * The first player token's own layer over the seating grid. It is a passive panel (it takes no press: the seat's own
 * control sets first player) sized to the first player's spot and moved to it from the spot's live rect, so it is right
 * after a resize and while the page scrolls. When the first player changes it flies FLIP-style from the old seat.
 */
import "@mc/ui";
import { flipOffset, type McFirstPlayerToken } from "@mc/ui";
import type Phaser from "phaser";
import { DomRegion } from "../../../dom/dom-region.js";
import { effectiveTokenMotion } from "../../../view/first-player-token-motion.js";
import { flightFrom } from "../../../view/first-player-token-flip.js";
import { appSession } from "../../../session.js";
import { t } from "../../../i18n/translate.js";
import type { Rect } from "../../../view/layout.js";

const TOKEN_URL = `${import.meta.env.BASE_URL}assets/first-player-token.svg`;

/** Whether the player (or the system) asks for less motion: the token then fades in at its new seat. */
const prefersLess = (): boolean =>
  appSession().settings.reducedMotion || (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

export class FirstPlayerTokenLayer {
  readonly #region: DomRegion<McFirstPlayerToken>;
  #index: number | null = null;
  #rect: Rect | null = null;

  constructor(scene: Phaser.Scene, mount: Rect) {
    const element = document.createElement("mc-first-player-token") as McFirstPlayerToken;
    element.src = TOKEN_URL;
    element.label = t("tableSetup.firstTokenLabel");
    this.#region = new DomRegion(scene, element, mount, { passive: true });
    this.#region.setHidden(true);
  }

  /** Puts the token on seat `index`'s spot (null: no seat holds it now). `spot` is the spot's rect on screen. */
  place(index: number | null, spot: Rect | null): void {
    if (index === null || !spot) {
      this.#region.setHidden(true);
      this.#index = null;
      this.#rect = null;
      return;
    }
    const before = this.#rect;
    const moved = this.#index !== null && this.#index !== index;
    this.#region.setRect(spot);
    this.#region.setHidden(false);
    this.#index = index;
    this.#rect = spot;
    if (!moved) return;
    const style = effectiveTokenMotion(appSession().settings);
    const reduced = prefersLess() && style !== "instant";
    this.#region.element.fly(reduced ? null : flightFrom(style, flipOffset(before, spot)), reduced);
  }

  /** What an e2e reads: which seat holds the token, where it is drawn now (its transform included) and where it rests. */
  probe(): { index: number; x: number; y: number; at: { x: number; y: number }; flying: boolean } | null {
    if (this.#index === null || !this.#rect) return null;
    const body = this.#region.element.renderRoot.querySelector<HTMLElement>(".token");
    const drawn = body ? this.#region.rectOf(body) : this.#rect;
    const at = { x: this.#rect.x + this.#rect.width / 2, y: this.#rect.y + this.#rect.height / 2 };
    return {
      index: this.#index,
      x: drawn.x + drawn.width / 2,
      y: drawn.y + drawn.height / 2,
      at,
      flying: this.#region.element.flying,
    };
  }

  destroy(): void {
    this.#region.destroy();
  }
}
