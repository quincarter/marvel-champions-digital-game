import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McShowTogglesStyles } from "./mc-show-toggles.styles.js";
import type { ShowTogglesModel } from "./mc-show-toggles.types.js";

/**
 * # Show toggles
 * The Hero and Basic switches (issue #977, benpap24): each one on shows that kind of card in the pool, off hides it, so an
 * aspect with both off lists that aspect's cards alone. Plain chips, filled while on with a tick ("a tinted Basic chip read
 * as on either way"). Inline, the word, the two chips and the pool's card count share one row.
 *
 * Focus stops: `type:show-hero`, `type:show-basic`.
 *
 * @element mc-show-toggles
 * @prop model - The switches (`ShowTogglesModel`).
 * @attr inline - One row with the card count at its end (the desktop's pool column).
 * @fires mc-deck-builder - `show` `{ key }`.
 */
export class McShowToggles extends BuilderElement {
  static override styles = [ThemeStyles, McShowTogglesStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    inline: { type: Boolean, reflect: true },
  };

  declare model: ShowTogglesModel | null;
  declare inline: boolean;

  constructor() {
    super();
    this.model = null;
    this.inline = false;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="row">
      <div class="label">${model.label}</div>
      <div class="chips">
        ${model.toggles.map(
          (toggle) =>
            html`<mc-button
              kind="secondary"
              data-stop=${`type:${toggle.id}`}
              .label=${toggle.shown ? `✓ ${toggle.label}` : toggle.label}
              ?selected=${toggle.shown}
              @mc-press=${this.send({ type: "show", key: toggle.key })}
            ></mc-button>`,
        )}
      </div>
      ${this.inline ? html`<span class="count">${model.count}</span>` : nothing}
    </div>`;
  }
}
