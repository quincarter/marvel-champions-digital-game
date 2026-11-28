import { html, LitElement, type PropertyDeclarations } from "lit";
import { McUnlocksPointsStyles } from "./mc-unlocks-points.styles.js";

/**
 * # Unlocks points
 * The champion points line at the top of Settings ▸ Unlocks: the reason to play for an unlock rather than switch it on.
 * Read-only text.
 *
 * @element mc-unlocks-points
 * @attr heading - The points line, already translated.
 * @attr detail - The line under it.
 */
export class McUnlocksPoints extends LitElement {
  static override styles = [McUnlocksPointsStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    detail: { type: String },
  };

  declare heading: string;
  declare detail: string;

  constructor() {
    super();
    this.heading = "";
    this.detail = "";
  }

  override render() {
    return html`<h2 class="heading">${this.heading}</h2>
      <p class="detail">${this.detail}</p>`;
  }
}
