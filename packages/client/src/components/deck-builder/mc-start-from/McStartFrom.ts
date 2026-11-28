import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McStartFromStyles } from "./mc-start-from.styles.js";
import type { StartFromModel } from "./mc-start-from.types.js";

/**
 * # Start from
 * New deck's second step for a hero with a published precon: the hero's picture, then an empty deck (the hero's own
 * cards) or the player's own copy of one of its precons, each named with its aspect and drawn in the aspect's colors.
 *
 * Focus stops: `start:empty`, `start:<precon id>`, `start:back`.
 *
 * @element mc-start-from
 * @prop model - The step (`StartFromModel`).
 * @fires mc-deck-builder - `start` (`id` null for empty), `start-back`.
 */
export class McStartFrom extends BuilderElement {
  static override styles = [ThemeStyles, McStartFromStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: StartFromModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="label">${model.label}</div>
      <mc-card-art .picture=${model.picture} card-id=${model.cardId} .frame=${2}></mc-card-art>
      ${model.options.map(
        (option) =>
          html`<mc-button
            kind="secondary"
            data-stop=${`start:${option.id ?? "empty"}`}
            style=${styleMap(option.tint ? { "--mc-tint-fill": option.tint.fill, "--mc-tint-ink": option.tint.ink } : {})}
            .label=${option.label}
            @mc-press=${this.send({ type: "start", id: option.id })}
          ></mc-button>`,
      )}
      <div class="gap"></div>
      <mc-button
        kind="secondary"
        data-stop="start:back"
        .label=${model.backLabel}
        @mc-press=${this.send({ type: "start-back" })}
      ></mc-button>`;
  }
}
