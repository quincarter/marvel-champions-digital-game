import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, watchCard } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McDeckLineStyles } from "./mc-deck-line.styles.js";
import type { DeckLineModel } from "./mc-deck-line.types.js";

/**
 * # Deck line
 * One line of "Your deck": the card's name, its copies and its own "-" (dimmed with the reason while the deck cannot be
 * edited or the card is pinned). A hold or a right-click on the line opens Inspect (`watchCard`, wired by the scene); a plain press does too where the line is
 * a campaign grant (the list is the only place to read it). A mouse over the line opens the card popover.
 *
 * @element mc-deck-line
 * @prop model - The line (`DeckLineModel`).
 * @fires mc-deck-builder - `remove` `{ cardId }`, `open`.
 */
export class McDeckLine extends BuilderElement {
  static override styles = [ThemeStyles, McDeckLineStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    openOnTap: { type: Boolean, reflect: true, attribute: "open-on-tap" },
  };

  declare model: DeckLineModel | null;
  declare openOnTap: boolean;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.model = null;
    this.openOnTap = false;
  }

  #open(): void {
    if (this.model) this.emit({ type: "open", cardId: this.model.cardId, face: this.model.face });
  }

  protected override willUpdate(): void {
    this.openOnTap = this.model?.openOnTap ?? false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unwatch = watchCard(this, () =>
      this.model ? { cardId: this.model.cardId, ...(this.model.face ? { face: { kind: "flipSide" } } : {}) } : null,
    );
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  protected override updated(): void {
    const name = this.renderRoot.querySelector(".name");
    if (name) this.tapPart(name, () => this.model?.openOnTap && this.#open());
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { minus } = model;
    return html`<div class="row" data-key=${`deck-line:${model.cardId}`}>
        <span class="name" data-key=${`deck-name:${model.cardId}`}>${model.name}</span>
        <span class="qty" data-key=${`deck-qty:${model.cardId}`}>${model.quantity}</span>
        <mc-button
          kind="secondary"
          label="−"
          data-key=${`deck-minus:${model.cardId}`}
          aria-label=${minus.aria}
          ?disabled=${minus.disabled !== null}
          .reason=${typeof minus.disabled === "string" ? minus.disabled : ""}
          @mc-press=${this.send({ type: "remove", cardId: model.cardId })}
        ></mc-button>
      </div>
      ${model.note ? html`<div class="note">${model.note}</div>` : nothing}`;
  }
}
