import { html, LitElement, type PropertyDeclarations } from "lit";
import { fitBlock, ThemeStyles } from "@mc/ui";
import { McScenarioStatCellStyles } from "./mc-scenario-stat-cell.styles.js";

/**
 * # Scenario stat cell
 * One cell of the stat strip: a small label over a display value. A value too long for the cell steps its type down
 * (to the caption floor) before it would need more lines than the cell has, and is never cut with an ellipsis.
 *
 * @element mc-scenario-stat-cell
 * @attr label - The label, already translated.
 * @attr value - The value, already translated.
 */
export class McScenarioStatCell extends LitElement {
  static override styles = [ThemeStyles, McScenarioStatCellStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    value: { type: String },
  };

  declare label: string;
  declare value: string;

  constructor() {
    super();
    this.label = "";
    this.value = "";
  }

  protected override updated(): void {
    const value = this.renderRoot.querySelector<HTMLElement>(".value");
    if (value) fitBlock(value, 8);
  }

  override render() {
    return html`<span class="label">${this.label}</span><span class="value">${this.value}</span>`;
  }
}
