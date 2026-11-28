import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import { TrophyRoomElement } from "../shared/TrophyRoomElement.js";
import { TROPHY_ROOM_EVENT, type TrophyRoomEventDetail } from "../shared/trophy-room-events.types.js";
import { McTrophyFiltersStyles } from "./mc-trophy-filters.styles.js";
import type { McTrophyFiltersProps, TrophyFiltersModel } from "./mc-trophy-filters.types.js";

/**
 * # Trophy filters
 * The bar under the rank header: the Filters button (the sort in force on it; Y on a pad) beside Expand all / Collapse all
 * (R3), and, while the filters are open, the four sorts (Category, Complete %, Points, A-Z) and the two directions as
 * chips. The chosen chip is filled and its word says so. Stops: `filters-toggle`, `expand-all`, `sort:<id>`,
 * `dir:asc`, `dir:desc`.
 *
 * Needs `@mc/ui` defined (`mc-hint-button`, `mc-chip`).
 *
 * @element mc-trophy-filters
 * @prop model - The bar (`TrophyFiltersModel`).
 * @fires mc-trophy-room - `{ type: "filters-toggle" | "expand-all" | "sort" | "direction" }`.
 */
export class McTrophyFilters extends TrophyRoomElement implements McTrophyFiltersProps {
  static override styles = [McTrophyFiltersStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: TrophyFiltersModel | null;

  constructor() {
    super();
    this.model = null;
    new FeatureRelay<TrophyRoomEventDetail>(this, TROPHY_ROOM_EVENT);
  }

  #button(
    stop: string,
    className: string,
    label: string,
    glyph: TrophyFiltersModel["toggleGlyph"],
    send: TrophyRoomEventDetail,
  ) {
    return html`<mc-hint-button
      class=${className}
      kind="secondary"
      plain
      data-stop=${stop}
      data-key=${stop}
      .label=${label}
      .glyph=${hintGlyphOf(glyph)}
      @mc-press=${(event: Event) => {
        event.stopPropagation();
        this.emit(send);
      }}
    ></mc-hint-button>`;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="bar">
        ${this.#button("filters-toggle", "toggle", m.toggleLabel, m.toggleGlyph, { type: "filters-toggle" })}
        ${this.#button("expand-all", "expand", m.expandLabel, m.expandGlyph, { type: "expand-all" })}
      </div>
      ${
        m.open
          ? html`<div class="chips" role="group">
                ${repeat(
                  m.sorts,
                  (sort) => sort.id,
                  (sort) =>
                    html`<mc-chip
                      .stop=${`sort:${sort.id}`}
                      label=${sort.label}
                      ?selected=${m.sort === sort.id}
                      .action=${{ type: "sort", sort: sort.id } satisfies TrophyRoomEventDetail}
                    ></mc-chip>`,
                )}
              </div>
              <div class="chips" role="group">
                <mc-chip
                  .stop=${"dir:asc"}
                  label=${m.ascendingLabel}
                  ?selected=${!m.descending}
                  .action=${{ type: "direction", descending: false } satisfies TrophyRoomEventDetail}
                ></mc-chip>
                <mc-chip
                  .stop=${"dir:desc"}
                  label=${m.descendingLabel}
                  ?selected=${m.descending}
                  .action=${{ type: "direction", descending: true } satisfies TrophyRoomEventDetail}
                ></mc-chip>
              </div>`
          : nothing
      }`;
  }
}
