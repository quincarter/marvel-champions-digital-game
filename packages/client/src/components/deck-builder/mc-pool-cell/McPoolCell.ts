import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import "../mc-copy-buttons/mc-copy-buttons.js";
import { McPoolCellStyles } from "./mc-pool-cell.styles.js";
import type { PoolCardModel } from "./mc-pool-cell.types.js";

/**
 * # Pool cell
 * One card of Card view: its scan with a cost pip, its name and caption, and a -, copies, + strip. A tap on the picture or
 * the caption opens Inspect (a hold or a right-click does too, and a mouse over the picture opens the card popover); a card
 * with copies in the deck wears a heavier red frame, so the state is the frame and the count, never colour alone.
 *
 * The cell is the `card:<id>` stop: Enter adds a copy (as its "+" does, and the scene refuses what the "+" refuses), Inspect
 * opens the card. The cell's box is the whole grid slot.
 *
 * @element mc-pool-cell
 * @prop model - The card (`PoolCardModel`).
 * @fires mc-deck-builder - `open`, `add`, `remove`.
 */
export class McPoolCell extends BuilderElement {
  static override styles = [ThemeStyles, McPoolCellStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    framed: { type: Boolean, reflect: true },
    stop: { type: String, reflect: true, attribute: "data-stop" },
  };

  declare model: PoolCardModel | null;
  declare framed: boolean;
  declare stop: string;

  constructor() {
    super();
    this.model = null;
    this.framed = false;
    this.stop = "";
  }

  protected override willUpdate(): void {
    this.stop = this.model ? `card:${this.model.cardId}` : "";
    this.framed = (this.model?.quantity ?? 0) > 0;
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
    return html`<div class="frame">
      <div class="face" data-key=${`open:${model.cardId}`}>
        <div class="art" data-key=${`art:${model.cardId}`}>
          <mc-card-art
            .picture=${model.picture}
            card-id=${model.cardId}
            .face=${model.face ? { kind: "flipSide" } : undefined}
          ></mc-card-art>
          ${model.cost !== null ? html`<span class="cost" data-key=${`cost:${model.cardId}`}>${model.cost}</span>` : nothing}
        </div>
        <div class="caption">
          <div class="title" data-key=${`name:${model.cardId}`}>${model.title}</div>
          <div class="line ${model.captionStrong ? "strong" : ""}" data-key=${`caption:${model.cardId}`}>
            ${model.caption}
          </div>
        </div>
      </div>
      <mc-copy-buttons
        .model=${{ cardId: model.cardId, minus: model.minus, plus: model.plus }}
        .quantity=${model.quantity}
      ></mc-copy-buttons>
    </div>`;
  }
}
