import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McGamesRowStyles } from "./mc-games-row.styles.js";
import type { GamesRowModel } from "./mc-games-row.types.js";

/**
 * # Games row
 * One card "From your games" suggests (issue #529, C2): its picture (a tap opens Inspect, a mouse over it opens the card
 * popover), its name, a line of why, and a Cut or Add button. A suggestion only: pressing the button is the same as the deck
 * list's "-" or the pool's "+".
 *
 * Focus stop: `games:<label>:<card id>` (the button).
 *
 * @element mc-games-row
 * @prop model - The card (`GamesRowModel`).
 * @attr section - The section's id, for the picture's key.
 * @fires mc-deck-builder - `add` / `remove` `{ cardId }`, `open`.
 */
export class McGamesRow extends BuilderElement {
  static override styles = [ThemeStyles, McGamesRowStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    section: { type: String },
  };

  declare model: GamesRowModel | null;
  declare section: string;

  constructor() {
    super();
    this.model = null;
    this.section = "";
  }

  protected override updated(): void {
    const art = this.renderRoot.querySelector(".art");
    if (art) this.tapPart(art, () => this.model && this.emit({ type: "open", cardId: this.model.cardId }));
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { action } = model;
    return html`<div class="art" data-key=${`games-open:${this.section}:${model.cardId}`}>
        <mc-card-art .picture=${model.picture} card-id=${model.cardId}></mc-card-art>
      </div>
      <div class="words">
        <div class="name">${model.name}</div>
        <div class="detail">${model.detail}</div>
      </div>
      ${
        action
          ? html`<mc-button
              kind="secondary"
              data-stop=${`games:${action.label}:${model.cardId}`}
              .label=${action.label}
              @mc-press=${this.send({ type: action.kind, cardId: model.cardId })}
            ></mc-button>`
          : nothing
      }`;
  }
}
