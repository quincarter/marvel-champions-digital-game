import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McBuilderSaveBarStyles } from "./mc-builder-save-bar.styles.js";
import type { SaveBarModel } from "./mc-builder-save-bar.types.js";

/**
 * # Save bar
 * Save, always under the deck so it stays reachable however far the list runs, and on a phone's Deck tab Review beside it.
 * Save reads "Saved" when nothing changed, "Saving" while a save is in flight (a second press waits) and "Save changes" in a
 * campaign; a frozen campaign deck dims it with the reason.
 *
 * Focus stops: `save`, `deck-review` (when the bar carries it).
 *
 * @element mc-builder-save-bar
 * @prop model - The bar (`SaveBarModel`).
 * @fires mc-deck-builder - `save`, `review`.
 */
export class McBuilderSaveBar extends BuilderElement {
  static override styles = [ThemeStyles, McBuilderSaveBarStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: SaveBarModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { save, review } = model;
    return html`${
        review
          ? html`<mc-button
              class="review"
              kind="secondary"
              data-stop="deck-review"
              .label=${review.label}
              ?disabled=${review.disabled !== null}
              @mc-press=${this.send({ type: "review" })}
            ></mc-button>`
          : nothing
      }
      <mc-button
        class="save"
        kind="primary"
        data-stop="save"
        .label=${save.label}
        ?disabled=${save.disabled !== null}
        .reason=${typeof save.disabled === "string" ? save.disabled : ""}
        @mc-press=${this.send({ type: "save" })}
      ></mc-button>`;
  }
}
