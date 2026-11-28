import { watchCard } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McPastGamePicturesStyles } from "./mc-past-game-pictures.styles.js";
import type { McPastGamePicturesProps, PastGamePicture, PastGamePicturesSize } from "./mc-past-game-pictures.types.js";
import "../mc-past-game-aspects/mc-past-game-aspects.js";

/**
 * # Past game pictures
 * A game's villain and heroes as card pictures: the villain first, a thin frame, the name printed on a stand-in when a
 * picture has no art (a custom hero or villain whose pack is gone), a hero's aspect chips along its foot. Every picture
 * with a card is a card picture (`watchCard`): a mouse over it opens the card hover popover, a hold opens Inspect.
 * The pictures take no press of their own; the row or panel that holds them does.
 *
 * Needs `@mc/ui` defined (`mc-picture-tile`).
 *
 * @element mc-past-game-pictures
 * @prop pictures - The pictures, villain first (`PastGamePicture`).
 * @attr size - row (default) | detail.
 * @cssprop --pic-h - A row picture's height (84px).
 */
export class McPastGamePictures extends LitElement implements McPastGamePicturesProps {
  static override styles = [McPastGamePicturesStyles];

  static override properties: PropertyDeclarations = {
    pictures: { attribute: false },
    size: { type: String, reflect: true },
  };

  declare pictures: readonly PastGamePicture[];
  declare size: PastGamePicturesSize;
  readonly #watched = new Map<Element, () => void>();

  constructor() {
    super();
    this.pictures = [];
    this.size = "row";
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const stop of this.#watched.values()) stop();
    this.#watched.clear();
  }

  protected override updated(): void {
    const present = new Set<Element>();
    for (const pic of this.renderRoot.querySelectorAll<HTMLElement>(".pic[data-card]")) {
      present.add(pic);
      if (this.#watched.has(pic)) continue;
      this.#watched.set(
        pic,
        watchCard(pic, () => (pic.dataset.card ? { cardId: pic.dataset.card } : null)),
      );
    }
    for (const [pic, stop] of this.#watched) {
      if (present.has(pic)) continue;
      stop();
      this.#watched.delete(pic);
    }
  }

  override render() {
    return html`${this.pictures.map(
      (pic, index) =>
        html`<div class="pic" data-role=${index === 0 ? "villain" : "hero"} data-card=${pic.cardId ?? nothing}>
          <mc-picture-tile .picture=${pic.picture} .frame=${0}></mc-picture-tile>
          ${pic.badges.length > 0 ? html`<mc-past-game-aspects .badges=${pic.badges}></mc-past-game-aspects>` : nothing}
        </div>`,
    )}`;
  }
}
