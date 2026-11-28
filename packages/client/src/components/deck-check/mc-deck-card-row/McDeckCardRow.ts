import { html, LitElement, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles } from "@mc/ui";
import { McDeckCardRowStyles } from "./mc-deck-card-row.styles.js";
import type { McDeckCardRowProps } from "./mc-deck-card-row.types.js";

/**
 * # Deck card row
 * One line of the deck on the narrow Curve tab: a pip with the printed cost, the name, and "×copies".
 *
 * @element mc-deck-card-row
 */
export class McDeckCardRow extends LitElement implements McDeckCardRowProps {
  static override styles = [ThemeStyles, McDeckCardRowStyles];

  static override properties: PropertyDeclarations = {
    cost: { attribute: false },
    costColor: { type: String, attribute: "cost-color" },
    name: { type: String },
    quantity: { type: Number },
  };

  declare cost: number | null;
  declare costColor: string;
  declare name: string;
  declare quantity: number;

  constructor() {
    super();
    this.cost = null;
    this.costColor = "";
    this.name = "";
    this.quantity = 1;
  }

  override render() {
    return html`<span class="pip" style=${styleMap(this.costColor ? { "--pip": this.costColor } : {})}
        >${this.cost ?? ""}</span
      >
      <span class="name">${this.name}</span>
      <span class="quantity">×${this.quantity}</span>`;
  }
}
