import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McSearchDetail, type McSearchField } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McPoolSearchStyles } from "./mc-pool-search.styles.js";
import type { PoolSearchModel } from "./mc-pool-search.types.js";

/**
 * # Pool search
 * The pool's search row: a real input with its own clear button, the ? that opens the cheat sheet and the Cards / List view
 * toggle. The search matches every word against a card's name, traits, type and rules text (`browsablePool`); this only says
 * what was typed (an empty text is the clear button). The field keeps the text the screen accepted, never a live draft.
 *
 * Focus stops: `filter-text`, `filter-clear` (while there is text), `filter-help`, `pool-view`.
 *
 * @element mc-pool-search
 * @prop model - The row (`PoolSearchModel`).
 * @fires mc-deck-builder - `search`, `search-help`, `pool-view`.
 */
export class McPoolSearch extends BuilderElement {
  static override styles = [ThemeStyles, McPoolSearchStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: PoolSearchModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The field, for the route's `blur` and the scene's `restoreValue`. */
  get field(): McSearchField | null {
    return this.renderRoot.querySelector<McSearchField>("mc-search-field");
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<mc-search-field
        data-stop="filter-text"
        clear-stop="filter-clear"
        .value=${model.text}
        .placeholder=${model.placeholder}
        .clearLabel=${model.clearLabel}
        @mc-search=${(event: CustomEvent<McSearchDetail>) => {
          event.stopPropagation();
          this.emit({ type: "search", text: event.detail.value });
        }}
      ></mc-search-field>
      <mc-button
        class="help"
        kind="secondary"
        data-stop="filter-help"
        label="?"
        aria-label=${model.helpLabel}
        @mc-press=${this.send({ type: "search-help" })}
      ></mc-button>
      <mc-button
        class="view"
        kind="secondary"
        data-stop="pool-view"
        .label=${model.viewLabel}
        @mc-press=${this.send({ type: "pool-view" })}
      ></mc-button>`;
  }
}
