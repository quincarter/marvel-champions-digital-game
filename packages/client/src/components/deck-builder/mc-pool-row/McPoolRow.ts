import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import "../mc-copy-buttons/mc-copy-buttons.js";
import type { PoolCardModel } from "../mc-pool-cell/mc-pool-cell.types.js";
import { McPoolRowStyles } from "./mc-pool-row.styles.js";

/**
 * # Pool row
 * One card of List view: its scan, name, type line, why it is offered, up to three lines of its rules text, and the copies,
 * - and + at the row's end. A tap on the picture or the words opens Inspect (a hold or right-click does too).
 *
 * The row is the `card:<id>` stop, as the cell is: Enter adds a copy, Inspect opens the card. Its box is the whole list slot
 * (the drawn row is 6px shorter, the gap between rows), so the buttons keep their place at the slot's right end.
 *
 * @element mc-pool-row
 * @prop model - The card (`PoolCardModel`).
 * @attr thumb-width - The picture's width in px.
 * @fires mc-deck-builder - `open`, `add`, `remove`.
 */
export class McPoolRow extends BuilderElement {
  static override styles = [ThemeStyles, McPoolRowStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    thumbWidth: { type: Number, attribute: "thumb-width" },
    stop: { type: String, reflect: true, attribute: "data-stop" },
  };

  declare model: PoolCardModel | null;
  declare thumbWidth: number;
  declare stop: string;

  constructor() {
    super();
    this.model = null;
    this.thumbWidth = 60;
    this.stop = "";
  }

  protected override willUpdate(): void {
    this.stop = this.model ? `card:${this.model.cardId}` : "";
  }

  /** The route's Enter: one more copy. */
  override click(): void {
    if (this.model) this.emit({ type: "add", cardId: this.model.cardId });
  }

  /** The route's Inspect. */
  inspect(): void {
    if (this.model) this.emit({ type: "open", cardId: this.model.cardId, face: this.model.face });
  }

  protected override updated(): void {
    const face = this.renderRoot.querySelector(".face");
    if (face) this.tapPart(face, () => this.inspect());
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`<div class="frame" data-key=${`row:${model.cardId}`}>
      <div
        class="face"
        data-key=${`open:${model.cardId}`}
        style=${styleMap({ "--thumb-width": `${this.thumbWidth}px` })}
      >
        <mc-card-art
          .picture=${model.picture}
          card-id=${model.cardId}
          .face=${model.face ? { kind: "flipSide" } : undefined}
        ></mc-card-art>
        <div class="words">
          <div class="title" data-key=${`name:${model.cardId}`}>${model.title}</div>
          <div class="type" data-key=${`type:${model.cardId}`}>${model.typeLine}</div>
          ${model.note ? html`<div class="note" data-key=${`note:${model.cardId}`}>${model.note}</div>` : nothing}
          ${
            model.rules
              ? html`<div class="rules ${model.note ? "short" : ""}" data-key=${`rules:${model.cardId}`}>
                  ${model.rules}
                </div>`
              : nothing
          }
        </div>
      </div>
      <mc-copy-buttons
        qty-first
        .model=${{ cardId: model.cardId, minus: model.minus, plus: model.plus }}
        .quantity=${model.quantity}
      ></mc-copy-buttons>
    </div>`;
  }
}
