import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McSearchField, type McShelfRoster } from "@mc/ui";
import "../../../components/scenario-select/mc-scenario-actions/mc-scenario-actions.js";
import "../../../components/scenario-select/mc-scenario-filters/mc-scenario-filters.js";
import "../../../components/scenario-select/mc-scenario-picked/mc-scenario-picked.js";
import "../../../components/scenario-select/mc-scenario-shelves/mc-scenario-shelves.js";
import "../../../components/scenario-select/mc-scenario-stats/mc-scenario-stats.js";
import type { McScenarioFilters } from "../../../components/scenario-select/mc-scenario-filters/McScenarioFilters.js";
import type { McScenarioShelves } from "../../../components/scenario-select/mc-scenario-shelves/McScenarioShelves.js";
import { pressOf } from "../../../components/scenario-select/scenario-select.types.js";
import { ScenarioSelectResponsive } from "../responsive.styles.js";
import { McScenarioSelectPageStyles } from "./mc-scenario-select-page.styles.js";
import type { ScenarioSelectPageModel } from "./mc-scenario-select-page.types.js";

/**
 * # Choose a scenario (page)
 * The whole screen as one element that only composes sections: the ink top bar, the filters (search, Filters button,
 * product chips), the shelves (Random row over the pack shelves), the stat strip, the picked scenario's stages panel and
 * the actions (Customize, Choose heroes). The scene mounts it in a `DomRegion`, sets `model`, and listens for
 * `mc-scenario-select` (and the roster's `mc-image-error`); every control is a `data-stop` the focus route walks.
 *
 * @element mc-scenario-select-page
 * @prop model - `ScenarioSelectPageModel`.
 * @attr wide - Set from the model: two columns.
 * @attr phone - Set from the model: the phone's bar and gutters.
 * @fires mc-scenario-select - `ScenarioSelectDetail`, from any section.
 */
export class McScenarioSelectPage extends LitElement {
  static override styles = [ThemeStyles, ScenarioSelectResponsive, McScenarioSelectPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    wide: { type: Boolean, reflect: true },
    phone: { type: Boolean, reflect: true },
  };

  declare model: ScenarioSelectPageModel | null;
  declare wide: boolean;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.wide = false;
    this.phone = false;
  }

  protected override willUpdate(): void {
    this.wide = this.model?.wide ?? false;
    this.phone = this.model?.phone ?? false;
  }

  /** The search field, for its caret (the scene's Escape and focus rules). */
  get searchField(): McSearchField | null {
    return this.renderRoot.querySelector<McScenarioFilters>("mc-scenario-filters")?.searchField ?? null;
  }

  /** The shelves' roster: its scroller, the pad's paging and the scroll position put back on a later visit. */
  get roster(): McShelfRoster | null {
    return this.renderRoot.querySelector<McScenarioShelves>("mc-scenario-shelves")?.roster ?? null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const covered = !m.wide && m.picked.collapsible && m.picked.picked && m.picked.open;
    return html`
      <mc-top-bar
        .heading=${m.topBar.title}
        .right=${m.topBar.right}
        .backLabel=${m.topBar.backLabel}
        .backGlyph=${m.topBar.backGlyph}
        .titleDrop=${m.topBar.titleDrop}
        .titleMaxRight=${m.topBar.titleMaxRight}
        ?compact=${m.phone}
        @mc-press=${pressOf(this, "back")}
      ></mc-top-bar>
      <div class="body">
        <div class="browse" ?data-covered=${covered}>
          <mc-scenario-filters ?wide=${m.wide} .model=${m.filters}></mc-scenario-filters>
          <mc-scenario-shelves .model=${m.shelves}></mc-scenario-shelves>
          ${m.wide && m.stats.length > 0 ? html`<mc-scenario-stats wide .cells=${m.stats}></mc-scenario-stats>` : nothing}
        </div>
        <div class="side" ?data-open=${covered}>
          <mc-scenario-picked ?wide=${m.wide} .model=${m.picked}></mc-scenario-picked>
          <mc-scenario-actions .ground=${m.wide ? "ink" : "paper"} .model=${m.actions}></mc-scenario-actions>
        </div>
      </div>
    `;
  }
}

if (!customElements.get("mc-scenario-select-page")) {
  customElements.define("mc-scenario-select-page", McScenarioSelectPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-scenario-select-page": McScenarioSelectPage;
  }
}
