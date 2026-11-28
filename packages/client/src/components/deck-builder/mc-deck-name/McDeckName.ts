import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McSearchDetail, type McSearchField } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McDeckNameStyles } from "./mc-deck-name.styles.js";
import type { DeckNameModel } from "./mc-deck-name.types.js";

/**
 * # Deck name
 * The deck's name over a real input. The name is kept as it is typed (a short pause), so Save never holds an older one; the
 * field holds the text the screen accepted, and a typed edit the screen refuses (a modal opened over it) is put back.
 *
 * Focus stop: `name`.
 *
 * @element mc-deck-name
 * @prop model - The field (`DeckNameModel`).
 * @fires mc-deck-builder - `name` `{ text }`.
 */
export class McDeckName extends BuilderElement {
  static override styles = [ThemeStyles, McDeckNameStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DeckNameModel | null;

  constructor() {
    super();
    this.model = null;
  }

  get field(): McSearchField | null {
    return this.renderRoot.querySelector<McSearchField>("mc-search-field");
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="label">${model.label}</div>
      <mc-search-field
        data-stop="name"
        .debounce=${60}
        .value=${model.text}
        .placeholder=${model.placeholder}
        .clearLabel=${model.clearLabel}
        @mc-search=${(event: CustomEvent<McSearchDetail>) => {
          event.stopPropagation();
          this.emit({ type: "name", text: event.detail.value });
        }}
      ></mc-search-field>`;
  }
}
