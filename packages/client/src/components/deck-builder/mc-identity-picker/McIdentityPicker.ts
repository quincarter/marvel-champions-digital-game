import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles, type McSearchDetail } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import "../mc-identity-tile/mc-identity-tile.js";
import { McIdentityPickerStyles } from "./mc-identity-picker.styles.js";
import type { IdentityPickerModel } from "./mc-identity-picker.types.js";

/**
 * # Identity picker
 * New deck's first step: a hero search over a grid of hero tiles in one native scroller, so it scrolls by drag, wheel and
 * paging, and a swipe over it never picks the hero it lifts over. The search holds the text the screen accepted; what is
 * typed reaches the scene as `identity-search` after the typing pause.
 *
 * Focus stops: `identity-search`, then `identity:<id>` per tile.
 *
 * @element mc-identity-picker
 * @prop model - The picker (`IdentityPickerModel`).
 * @fires mc-deck-builder - `identity-search`, `pick-hero`, `hero-inspect`.
 */
export class McIdentityPicker extends BuilderElement {
  static override styles = [ThemeStyles, McIdentityPickerStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: IdentityPickerModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The tile grid's scroller: what the pad's stick and paging move. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".grid");
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="label">${model.label}</div>
      <mc-search-field
        data-stop="identity-search"
        .value=${model.search.text}
        .placeholder=${model.search.placeholder}
        .clearLabel=${model.search.clearLabel}
        @mc-search=${(event: CustomEvent<McSearchDetail>) => {
          event.stopPropagation();
          this.emit({ type: "identity-search", text: event.detail.value });
        }}
      ></mc-search-field>
      ${
        model.empty !== null
          ? html`<div class="empty">${model.empty}</div>`
          : html`<div class="grid" style=${styleMap({ "--tile-min": `${model.tileMin}px` })} @mc-pressed=${this.relay}>
              ${repeat(
                model.tiles,
                (tile) => tile.id,
                (tile) => html`<mc-identity-tile .model=${tile}></mc-identity-tile>`,
              )}
            </div>`
      }`;
  }
}
