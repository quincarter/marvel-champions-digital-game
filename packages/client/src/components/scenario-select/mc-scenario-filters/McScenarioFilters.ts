import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McSearchDetail, type McSearchField } from "@mc/ui";
import { pressOf, raiseScenarioSelect } from "../scenario-select.types.js";
import "../mc-scenario-chips/mc-scenario-chips.js";
import "../mc-scenario-inspect-hint/mc-scenario-inspect-hint.js";
import { McScenarioFiltersStyles } from "./mc-scenario-filters.styles.js";
import type { ScenarioFiltersModel } from "./mc-scenario-filters.types.js";

/**
 * # Scenario filters
 * The top of Choose a scenario's list: the search field, the magnifier toggle that shows it on a narrow screen, the
 * Filters button (with the pad's Inspect hint beside it on a wide one) and the product chips. A wide screen draws the
 * field always, with the chips wrapped under it; a narrow one draws the toggle and the chips as one sideways rail, the
 * field only while the toggle is on.
 *
 * Focus stops, in order: `scenario-search-toggle`, `scenario-search`, `filters-toggle`, `scenario-chip:<id>`.
 *
 * @element mc-scenario-filters
 * @prop model - `ScenarioFiltersModel`.
 * @attr wide - A wide screen's arrangement (set by the page).
 * @fires mc-scenario-select - A `press` of a control or a chip, and a `search` with the typed text.
 */
export class McScenarioFilters extends LitElement {
  static override styles = [ThemeStyles, McScenarioFiltersStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    wide: { type: Boolean, reflect: true },
  };

  declare model: ScenarioFiltersModel | null;
  declare wide: boolean;

  constructor() {
    super();
    this.model = null;
    this.wide = false;
  }

  /** The search field, for its caret (the scene's Escape and focus rules). */
  get searchField(): McSearchField | null {
    return this.renderRoot.querySelector<McSearchField>("mc-search-field");
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const inlineChips = m.filtersButton === null;
    return html`
      ${
        m.searchToggle
          ? html`<mc-search-toggle
              class="toggle"
              data-stop="scenario-search-toggle"
              .label=${m.searchToggle.label}
              ?selected=${m.searchToggle.active}
              @mc-press=${pressOf(this, "scenario-search-toggle")}
            ></mc-search-toggle>`
          : nothing
      }
      ${
        m.searchShown
          ? html`<mc-search-field
              class="search"
              data-key="scenario-search"
              data-stop="scenario-search"
              .value=${m.searchValue}
              .placeholder=${m.placeholder}
              .clearLabel=${m.clearLabel}
              .debounce=${140}
              .maxLength=${80}
              escape-clears
              @mc-search=${(event: CustomEvent<McSearchDetail>) => {
                event.stopPropagation();
                raiseScenarioSelect(this, { type: "search", value: event.detail.value });
              }}
            ></mc-search-field>`
          : nothing
      }
      ${
        m.inspectHint
          ? html`<mc-scenario-inspect-hint
              class="hint"
              .text=${m.inspectHint.text}
              .glyph=${m.inspectHint.glyph}
            ></mc-scenario-inspect-hint>`
          : nothing
      }
      ${
        m.filtersButton
          ? html`<mc-hint-button
              class="filters"
              data-stop="filters-toggle"
              plain
              .label=${m.filtersButton.label}
              .glyph=${m.filtersButton.glyph}
              @mc-press=${pressOf(this, "filters-toggle")}
            ></mc-hint-button>`
          : nothing
      }
      ${
        m.chipsShown
          ? html`<mc-scenario-chips
              class=${inlineChips ? "chips inline" : "chips"}
              ?rail=${!this.wide}
              .chips=${m.chips}
            ></mc-scenario-chips>`
          : nothing
      }
    `;
  }
}
