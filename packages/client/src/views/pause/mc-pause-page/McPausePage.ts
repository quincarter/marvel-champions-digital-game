import type { McSearchField } from "@mc/ui";
import { ThemeStyles } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { classMap } from "lit/directives/class-map.js";
import "../../../components/pause/mc-pause-confirm/mc-pause-confirm.js";
import "../../../components/pause/mc-pause-header/mc-pause-header.js";
import "../../../components/pause/mc-pause-log/mc-pause-log.js";
import "../../../components/pause/mc-pause-menu/mc-pause-menu.js";
import "../../../components/pause/mc-pause-quick/mc-pause-quick.js";
import "../../../components/pause/mc-pause-results/mc-pause-results.js";
import "../../../components/pause/mc-pause-rules/mc-pause-rules.js";
import "../../../components/pause/mc-pause-table/mc-pause-table.js";
import type { PausePageModel } from "../../../components/pause/pause.types.js";
import { PauseElement } from "../../../components/pause/shared/PauseElement.js";
import { McPausePageStyles } from "./mc-pause-page.styles.js";

/**
 * # Pause
 * The page: it only composes the sections and holds no state.
 *
 * Wide (desktop and tablet, both orientations): an ink panel on the left (the header over the menu column) beside a pane
 * on the right: the search field, and under it either the Rules reference over "Jump to a moment", the Full game log, or,
 * with something typed, the search results (the pane turns ink). Phone: one ink sheet: the header with its ✕, the search
 * field, a body that scrolls (the results, or the Reference group over the Table and Guide groups or the log), and the
 * footer. Layout is CSS: native scrolling, and on a short screen (a phone held sideways) the menu column scrolls and
 * compacts, so no button is ever drawn over another. The Concede confirm covers the sheet while it is up.
 *
 * @element mc-pause-page
 * @prop model - What the page shows (`PausePageModel`).
 * @fires mc-pause - every section's event, as it bubbles.
 * @fires mc-search - the search field's text (`McSearchDetail`).
 * @fires mc-search-focus - the caret went into or left the search field.
 */
export class McPausePage extends PauseElement {
  static override styles = [ThemeStyles, McPausePageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare model: PausePageModel | null;
  declare mode: "wide" | "phone";

  constructor() {
    super();
    this.model = null;
    this.mode = "wide";
  }

  protected override willUpdate(): void {
    this.mode = this.model?.mode ?? "wide";
  }

  /** The search field, for the scene (the caret, a pad's focus). */
  get searchField(): McSearchField | null {
    return this.renderRoot.querySelector<McSearchField>("mc-search-field");
  }

  /** Reads the results and the groups again from their top (a new query, the Reference toggled). */
  resetScroll(): void {
    for (const scroller of this.renderRoot.querySelectorAll<HTMLElement>(".scroller")) scroller.scrollTop = 0;
  }

  #search(model: PausePageModel) {
    const { value, placeholder, clearLabel } = model.search;
    return html`<mc-search-field
      class="search"
      data-stop="search"
      .value=${value}
      .placeholder=${placeholder}
      .clearLabel=${clearLabel}
      .debounce=${120}
    ></mc-search-field>`;
  }

  #wide(model: PausePageModel) {
    const searching = model.searching;
    return html`<div class="sheet">
      <aside class="left">
        <mc-pause-header .input=${model.header} mode="wide"></mc-pause-header>
        <mc-pause-menu .items=${model.menu} mode="wide"></mc-pause-menu>
      </aside>
      <section class=${classMap({ right: true, ink: searching })}>
        ${this.#search(model)}
        <div class=${classMap({ body: true, scroller: searching })}>
          ${
            searching && model.results
              ? html`<mc-pause-results .input=${model.results}></mc-pause-results>`
              : model.logExpanded
                ? html`<mc-pause-log class="log" .input=${model.log}></mc-pause-log>`
                : html`<mc-pause-rules class="rules" .input=${model.rules}></mc-pause-rules>
                    <mc-pause-log class="log" .input=${model.log}></mc-pause-log>`
          }
        </div>
      </section>
    </div>`;
  }

  #phone(model: PausePageModel) {
    return html`<div class="sheet">
      <mc-pause-header .input=${model.header} mode="phone"></mc-pause-header>
      ${this.#search(model)}
      <div class="body scroller">
        ${
          model.searching && model.results
            ? html`<mc-pause-results .input=${model.results}></mc-pause-results>`
            : html`<mc-pause-quick .input=${model.quick}></mc-pause-quick> ${
                  model.logExpanded
                    ? html`<mc-pause-log class="log" .input=${model.log}></mc-pause-log>`
                    : html`<mc-pause-table .input=${model.table}></mc-pause-table>`
                }`
        }
      </div>
      <mc-pause-menu .items=${model.menu} mode="phone"></mc-pause-menu>
    </div>`;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="stage" ?inert=${model.confirm !== null}>
        ${model.mode === "phone" ? this.#phone(model) : this.#wide(model)}
      </div>
      <mc-pause-confirm .input=${model.confirm}></mc-pause-confirm>`;
  }
}
