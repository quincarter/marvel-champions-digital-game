import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { McPress, watchCard } from "@mc/ui";
import { McStatsRowStyles } from "./mc-stats-row.styles.js";
import type { McStatsRowProps, StatsRowModel } from "./mc-stats-row.types.js";

/**
 * # Stats row
 * One boxed fact of a list tab: its label and figure, a line under it, a picture of its card (a mouse over it opens the
 * card popover), a small bar of why its games were lost, and a "View game" link when it comes from one game. The row is one
 * focus stop, `row:<id>`: a tap opens the game when it names one; a hold, or the route's Inspect, opens its card; the
 * route's Enter does what a tap does, and on a card row with no game it inspects the card.
 *
 * @element mc-stats-row
 * @prop row - The row (`StatsRowModel`).
 * @fires mc-pressed - A tap: `{ type: "open-game", gameId }`; a hold: `{ type: "card", cardId }`.
 */
export class McStatsRow extends McPress implements McStatsRowProps {
  static override styles = McStatsRowStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    row: { attribute: false },
    highlight: { type: Boolean, reflect: true },
    linked: { type: Boolean, reflect: true },
    hasCard: { type: Boolean, reflect: true, attribute: "has-card" },
  };

  declare row: StatsRowModel | null;
  declare highlight: boolean;
  declare linked: boolean;
  declare hasCard: boolean;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.row = null;
    this.highlight = false;
    this.linked = false;
    this.hasCard = false;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has("row")) return;
    const row = this.row;
    this.highlight = row?.highlight ?? false;
    this.linked = row?.gameId != null;
    this.hasCard = row?.cardId != null && row.picture !== null;
    this.action = row?.gameId != null ? { type: "open-game", gameId: row.gameId } : null;
    this.holdAction = row?.cardId != null ? { type: "card", cardId: row.cardId } : null;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const thumb = this.renderRoot.querySelector<HTMLElement>(".thumb");
    if (!thumb || this.#unwatch) return;
    // Bound once: the thumb is kept for the life of the row while it names a card.
    this.#unwatch = watchCard(thumb, () => {
      const cardId = this.row?.cardId;
      return cardId ? { cardId } : null;
    });
  }

  /** The route's Enter: what a tap does, and on a card row with no game, Inspect. */
  override click(): void {
    if (this.row?.gameId != null) this.press();
    else if (this.row?.cardId != null) this.inspect();
  }

  override render() {
    const row = this.row;
    if (!row) return nothing;
    return html`<div class="row">
      ${
        row.cardId !== null && row.picture
          ? html`<mc-picture-tile
              class="thumb"
              data-card-id=${row.cardId}
              .picture=${row.picture}
              ground="parchment"
            ></mc-picture-tile>`
          : nothing
      }
      <div class="main">
        <span class="label" title=${row.label}>${row.label}</span>
        <span class="value">${row.value}</span>
        ${row.detail ? html`<span class="detail">${row.detail}</span>` : nothing}
        ${
          row.losses.length > 0
            ? html`<div class="loss">
                <mc-segment-bar .parts=${row.losses} .height=${12}></mc-segment-bar>
                <span class="legend">${row.lossLegend}</span>
              </div>`
            : nothing
        }
        ${row.gameId !== null ? html`<span class="link">${row.linkLabel}</span>` : nothing}
      </div>
    </div>`;
  }
}
