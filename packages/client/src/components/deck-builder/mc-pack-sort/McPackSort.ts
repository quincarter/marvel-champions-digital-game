import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type StepperPressDetail } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McPackSortStyles } from "./mc-pack-sort.styles.js";
import type { PackSortModel } from "./mc-pack-sort.types.js";

/**
 * # Pack and sort
 * The pool's Pack stepper (< name >), Wave button and the Sort and Then buttons. One combined control would have hidden
 * which wave a pack belongs to, so: a full-width pack row over a full-width wave button and a half-width pair of sort
 * buttons, which is what fits a 375px column. Pressing the pack name or the wave button opens a picker where several are
 * chosen at once (issue #977); the arrows step one pack at a time.
 *
 * Focus stops: `pack:prev`, `pack:name`, `pack:next`, `pack:cycle`, `pack:sort`, `pack:then`.
 *
 * @element mc-pack-sort
 * @prop model - The controls (`PackSortModel`).
 * @fires mc-deck-builder - `pack-step`, `pack-pick`, `cycle-pick`, `sort`, `then`.
 */
export class McPackSort extends BuilderElement {
  static override styles = [ThemeStyles, McPackSortStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: PackSortModel | null;

  constructor() {
    super();
    this.model = null;
  }

  #step = (event: CustomEvent<StepperPressDetail>): void => {
    event.stopPropagation();
    const { part } = event.detail;
    this.emit(part === "name" ? { type: "pack-pick" } : { type: "pack-step", dir: part === "prev" ? -1 : 1 });
  };

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="label">${model.label}</div>
      <div class="stack">
        <mc-stepper
          prev-stop="pack:prev"
          name-stop="pack:name"
          next-stop="pack:next"
          .label=${model.pack.label}
          ?selected=${model.pack.on}
          @mc-stepper-press=${this.#step}
        ></mc-stepper>
        <mc-button
          kind="secondary"
          data-stop="pack:cycle"
          .label=${model.cycle.label}
          ?selected=${model.cycle.on}
          @mc-press=${this.send({ type: "cycle-pick" })}
        ></mc-button>
        <div class="pair">
          <mc-button
            kind="secondary"
            data-stop="pack:sort"
            .label=${model.sort.label}
            ?selected=${model.sort.on}
            @mc-press=${this.send({ type: "sort" })}
          ></mc-button>
          <mc-button
            kind="secondary"
            data-stop="pack:then"
            .label=${model.then.label}
            ?selected=${model.then.on}
            @mc-press=${this.send({ type: "then" })}
          ></mc-button>
        </div>
      </div>`;
  }
}
