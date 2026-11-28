import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McTypeFiltersStyles } from "./mc-type-filters.styles.js";
import type { TypeFiltersModel } from "./mc-type-filters.types.js";

/**
 * # Type filters
 * The pool's type chips: "All" plus every card type the pool holds, one chosen (the chosen chip is the ink fill). They wrap
 * as the column narrows and share each row's width.
 *
 * Focus stops: `type:<id>`.
 *
 * @element mc-type-filters
 * @prop model - The chips (`TypeFiltersModel`).
 * @fires mc-deck-builder - `type-filter` `{ id }`.
 */
export class McTypeFilters extends BuilderElement {
  static override styles = [ThemeStyles, McTypeFiltersStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: TypeFiltersModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="label">${model.label}</div>
      <div class="chips">
        ${model.chips.map(
          (chip) =>
            html`<mc-button
              kind="secondary"
              data-stop=${`type:${chip.id}`}
              .label=${chip.label}
              ?selected=${chip.selected}
              @mc-press=${this.send({ type: "type-filter", id: chip.id })}
            ></mc-button>`,
        )}
      </div>`;
  }
}
