import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { McPress, watchCard } from "@mc/ui";
import { McStatsMatchupShelfStyles } from "./mc-stats-matchup-shelf.styles.js";
import type { McStatsMatchupShelfProps, StatsShelfModel } from "./mc-stats-matchup-shelf.types.js";

/**
 * # Matchups shelf
 * One villain in the Shelves view: its picture and record, a bar of its wins by tier, one pip per hero (wins first, then
 * played, then not played) and a badge naming the hardest tier beaten. A press opens the Focus view on that villain (the
 * focus stop is `row:shelf:<row>`). The pictures open the card popover.
 *
 * @element mc-stats-matchup-shelf
 * @prop shelf - The shelf (`StatsShelfModel`).
 * @fires mc-pressed - `{ type: "open-focus", row }`.
 */
export class McStatsMatchupShelf extends McPress implements McStatsMatchupShelfProps {
  static override styles = McStatsMatchupShelfStyles;

  static override properties: PropertyDeclarations = { ...McPress.properties, shelf: { attribute: false } };

  declare shelf: StatsShelfModel | null;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.shelf = null;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has("shelf")) return;
    this.stop = this.shelf ? `row:shelf:${this.shelf.row}` : "";
    this.action = this.shelf ? { type: "open-focus", row: this.shelf.row } : null;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const thumb = this.renderRoot.querySelector<HTMLElement>(".thumb");
    if (!thumb || this.#unwatch) return;
    this.#unwatch = watchCard(thumb, () => (this.shelf?.cardId ? { cardId: this.shelf.cardId } : null));
  }

  override render() {
    const shelf = this.shelf;
    if (!shelf) return nothing;
    return html`<div class="shelf">
      <mc-picture-tile
        class="thumb"
        data-card-id=${shelf.cardId ?? ""}
        .picture=${shelf.picture ?? { src: null }}
        ground="parchment"
      ></mc-picture-tile>
      <div class="who">
        <mc-stats-credited class="name" label=${shelf.name.toUpperCase()}></mc-stats-credited>
        <div class="summary"><span class="long">${shelf.summary}</span><span class="short">${shelf.short}</span></div>
      </div>
      <div class="detail">
        <div class="bars">
          <mc-segment-bar .parts=${shelf.bar} .total=${shelf.total} .height=${12}></mc-segment-bar>
          <div class="pips">
            ${shelf.pips.map(
              (pip) => html`<span class="pip" data-kind=${pip.kind} style=${styleMap({ "--pip": pip.color })}></span>`,
            )}
          </div>
        </div>
        ${
          shelf.best
            ? html`<div class="badge" style=${styleMap({ "--badge": shelf.bestColor, "--badge-ink": shelf.bestInk })}>
                ${shelf.best}
              </div>`
            : nothing
        }
      </div>
    </div>`;
  }
}
