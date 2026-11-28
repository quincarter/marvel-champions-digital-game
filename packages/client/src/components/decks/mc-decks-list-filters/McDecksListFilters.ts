import { html, nothing, type PropertyDeclarations } from "lit";
import type { McSearchDetail } from "@mc/ui";
import { DecksElement } from "../shared/DecksElement.js";
import { DecksSharedStyles } from "../shared/decks-shared.styles.js";
import type { DecksListModel } from "../decks.types.js";
import { McDecksListFiltersStyles } from "./mc-decks-list-filters.styles.js";

/** The part of the list model this element draws. */
export type DecksListFiltersModel = Pick<DecksListModel, "search" | "filtersLabel" | "filtersOpen" | "chips">;

/**
 * # Decks list filters
 * The deck list's search field and its Filters button on one row, then the quick-filter chips (aspect, source, list, Legal
 * only) while the button has them open. The search text is the one the screen has taken: a field keeps its own draft across a
 * redraw while the text it was given is unchanged.
 *
 * Focus stops: `deck-search`, `filters-toggle`, `deck-chip:<chip id>`.
 *
 * @element mc-decks-list-filters
 * @prop model - The row (`DecksListFiltersModel`).
 * @fires mc-decks - `search` (list `deck`), `chip` (list `deck`) or `action` `filters-toggle`.
 * @fires mc-search-focus - Bubbles from the search field: whether the caret is in it (the route stands aside while it is).
 */
export class McDecksListFilters extends DecksElement {
  static override styles = [DecksSharedStyles, McDecksListFiltersStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DecksListFiltersModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The search field, for the scene's text-field escape and its caret. */
  get field(): HTMLElement | null {
    return this.renderRoot.querySelector("mc-search-field");
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { search } = model;
    return html`<div class="bar">
        <mc-search-field
          class="search"
          data-key="deck-search"
          data-stop="deck-search"
          .value=${search.text}
          .placeholder=${search.placeholder}
          .clearLabel=${search.clearLabel}
          .focusPlaceholder=${search.focusPlaceholder ?? ""}
          .maxLength=${80}
          .debounce=${140}
          @mc-search=${(event: CustomEvent<McSearchDetail>) => {
            event.stopPropagation();
            this.emit({ type: "search", list: "deck", text: event.detail.value });
          }}
        ></mc-search-field>
        <mc-button
          class="filters"
          kind="secondary"
          data-key="filters"
          data-stop="filters-toggle"
          .label=${`${model.filtersLabel} ${model.filtersOpen ? "▴" : "▾"}`}
          ?selected=${model.filtersOpen}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            this.act("filters-toggle");
          }}
        ></mc-button>
      </div>
      ${
        model.chips.length > 0
          ? html`<div class="chips" data-key="deck-chips">${this.chips("deck", model.chips, "deck-chip")}</div>`
          : nothing
      }`;
  }
}
