import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import { McCopyButtonsStyles } from "./mc-copy-buttons.styles.js";
import type { CopyButtonsModel } from "./mc-copy-buttons.types.js";

/**
 * # Copy buttons
 * A card's "-", its copies in the deck and "+". A button that cannot be pressed stays in place, dimmed, with the reason as
 * its tooltip (a campaign's locked line, a deck rule); pressing it does nothing. The scene checks again when it hears the
 * press, so this element never decides what is legal.
 *
 * @element mc-copy-buttons
 * @prop model - The buttons (`CopyButtonsModel`).
 * @prop quantity - Copies in the deck: "x2", or nothing at 0.
 * @attr qty-first - The count sits before the buttons (a list row's cluster) rather than between them.
 * @fires mc-deck-builder - `remove` / `add` `{ cardId }`.
 */
export class McCopyButtons extends BuilderElement {
  static override styles = [ThemeStyles, McCopyButtonsStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    quantity: { type: Number },
    qtyFirst: { type: Boolean, attribute: "qty-first", reflect: true },
  };

  declare model: CopyButtonsModel | null;
  declare quantity: number;
  declare qtyFirst: boolean;

  constructor() {
    super();
    this.model = null;
    this.quantity = 0;
    this.qtyFirst = false;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const { cardId, minus, plus } = model;
    const reason = (off: string | true | null): string => (typeof off === "string" ? off : "");
    return html`<mc-button
        kind="secondary"
        label="−"
        data-key=${`minus:${cardId}`}
        aria-label=${minus.aria}
        ?disabled=${minus.disabled !== null}
        .reason=${reason(minus.disabled)}
        @mc-press=${this.send({ type: "remove", cardId })}
      ></mc-button>
      <span class="qty" data-key=${`qty:${cardId}`}
        >${this.qtyFirst ? String(this.quantity) : this.quantity > 0 ? `×${this.quantity}` : ""}</span
      >
      <mc-button
        kind="secondary"
        label="+"
        data-key=${`plus:${cardId}`}
        aria-label=${plus.aria}
        ?disabled=${plus.disabled !== null}
        .reason=${reason(plus.disabled)}
        @mc-press=${this.send({ type: "add", cardId })}
      ></mc-button>`;
  }
}
