import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type StepperPressDetail } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McQuickFiltersStyles } from "./mc-quick-filters.styles.js";
import type { QuickChipModel, QuickFiltersModel } from "./mc-quick-filters.types.js";

/**
 * # Quick filters
 * Cost chips 0 to 5+, resource icon chips, and a trait stepper (< name >, wrapping through "All traits") over the traits the
 * pool holds under the other filters (issue #531). Built for a tap on a phone, where typing `o:2` is slow; each chip toggles.
 * A wide column puts everything on one row; a narrow one stacks cost, icons and the stepper.
 *
 * Focus stops: `quick:cost:<n>`, `quick:icon:<icon>`, `trait:prev`, `trait:name`, `trait:next`.
 *
 * @element mc-quick-filters
 * @prop model - The filters (`QuickFiltersModel`).
 * @fires mc-deck-builder - `quick` `{ id }`, `trait` `{ dir }`.
 */
export class McQuickFilters extends BuilderElement {
  static override styles = [ThemeStyles, McQuickFiltersStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: QuickFiltersModel | null;

  constructor() {
    super();
    this.model = null;
  }

  #chip(chip: QuickChipModel) {
    return html`<mc-button
      kind="secondary"
      data-stop=${`quick:${chip.id}`}
      .label=${chip.text}
      ?selected=${chip.on}
      @mc-press=${this.send({ type: "quick", id: chip.id })}
    ></mc-button>`;
  }

  #step = (event: CustomEvent<StepperPressDetail>): void => {
    event.stopPropagation();
    this.emit({ type: "trait", dir: event.detail.part === "prev" ? -1 : 1 });
  };

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="label">${model.label}</div>
      <div class="rows">
        <div class="group costs">${model.costs.map((chip) => this.#chip(chip))}</div>
        <div class="group icons">${model.icons.map((chip) => this.#chip(chip))}</div>
        <mc-stepper
          prev-stop="trait:prev"
          name-stop="trait:name"
          next-stop="trait:next"
          .label=${model.trait.name}
          ?selected=${model.trait.on}
          @mc-stepper-press=${this.#step}
        ></mc-stepper>
      </div>`;
  }
}
