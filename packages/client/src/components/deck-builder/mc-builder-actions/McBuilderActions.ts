import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import type { DeckBuilderEventDetail } from "../shared/deck-builder-events.types.js";
import { McBuilderActionsStyles } from "./mc-builder-actions.styles.js";
import type { ActionButtonModel, BuilderActionsModel } from "./mc-builder-actions.types.js";

/**
 * # Builder actions
 * Preconstructed and Clear (and Delete for a saved deck) in one row, and below it a campaign's optional deck freeze (MC27
 * p. 6). A button that does nothing now stays in place, dimmed, with its reason; Delete asks first (its second press, armed,
 * deletes). The scene decides each press.
 *
 * Focus stops: `preconstructed`, `clear`, `delete`, `freeze-deck`.
 *
 * @element mc-builder-actions
 * @prop model - The buttons (`BuilderActionsModel`).
 * @attr on-dark - On the ink panel.
 * @fires mc-deck-builder - `precon`, `clear`, `delete`, `freeze`.
 */
export class McBuilderActions extends BuilderElement {
  static override styles = [ThemeStyles, McBuilderActionsStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    onDark: { type: Boolean, attribute: "on-dark", reflect: true },
  };

  declare model: BuilderActionsModel | null;
  declare onDark: boolean;

  constructor() {
    super();
    this.model = null;
    this.onDark = false;
  }

  #button(stop: string, button: ActionButtonModel | null, detail: DeckBuilderEventDetail) {
    if (!button) return nothing;
    return html`<mc-button
      kind=${this.onDark ? "onInk" : "secondary"}
      data-stop=${stop}
      .label=${button.label}
      ?selected=${button.armed === true}
      ?disabled=${button.disabled !== null}
      .reason=${typeof button.disabled === "string" ? button.disabled : ""}
      @mc-press=${this.send(detail)}
    ></mc-button>`;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const row = [model.precon, model.clear, model.delete].some((b) => b !== null);
    return html`${
      row
        ? html`<div class="row">
            ${this.#button("preconstructed", model.precon, { type: "precon" })}
            ${this.#button("clear", model.clear, { type: "clear" })}
            ${this.#button("delete", model.delete, { type: "delete" })}
          </div>`
        : nothing
    }
    ${this.#button("freeze-deck", model.freeze, { type: "freeze" })}`;
  }
}
