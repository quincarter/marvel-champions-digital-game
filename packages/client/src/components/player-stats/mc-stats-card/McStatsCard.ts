import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { McPress, watchCard } from "@mc/ui";
import { McStatsCardStyles } from "./mc-stats-card.styles.js";
import type { McStatsCardProps, StatsCardModel } from "./mc-stats-card.types.js";

/**
 * # Stats card
 * A card the stats name, as its picture with what you did with it under it (how many times, in how many games). A mouse
 * over the picture opens the card popover; a tap does nothing (it is a picture to read, not a button); a hold, the route's
 * Inspect and Enter open the card in Inspect.
 *
 * @element mc-stats-card
 * @prop card - The card (`StatsCardModel`).
 * @fires mc-pressed - A hold or Inspect: `{ type: "card", cardId }`.
 */
export class McStatsCard extends McPress implements McStatsCardProps {
  static override styles = McStatsCardStyles;

  static override properties: PropertyDeclarations = { ...McPress.properties, card: { attribute: false } };

  declare card: StatsCardModel | null;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.card = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has("card")) return;
    this.stop = this.card?.key ?? "";
    this.holdAction = this.card ? { type: "card", cardId: this.card.cardId } : null;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const picture = this.renderRoot.querySelector<HTMLElement>("mc-picture-tile");
    if (!picture || this.#unwatch) return;
    this.#unwatch = watchCard(picture, () => (this.card ? { cardId: this.card.cardId } : null));
  }

  /** The route's Enter: a card's one action is Inspect. */
  override click(): void {
    this.inspect();
  }

  override render() {
    const card = this.card;
    if (!card) return nothing;
    return html`<mc-picture-tile
        data-card-id=${card.cardId}
        .picture=${card.picture ?? { src: null }}
      ></mc-picture-tile>
      <div class="value">${card.value}</div>
      <div class="detail">${card.detail}</div>`;
  }
}
