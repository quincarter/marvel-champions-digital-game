import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McScenarioSetBlockStyles } from "./mc-scenario-set-block.styles.js";

/**
 * # Scenario set block
 * A label over a value on the ink panel ("ENCOUNTER SETS" over their names, "RECOMMENDED MODULAR" over the modular
 * sets), as Take your seats prints its obligation and nemesis set.
 *
 * @element mc-scenario-set-block
 * @attr heading - The label, already translated.
 * @attr value - The names, already translated.
 */
export class McScenarioSetBlock extends LitElement {
  static override styles = [ThemeStyles, McScenarioSetBlockStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    value: { type: String },
  };

  declare heading: string;
  declare value: string;

  constructor() {
    super();
    this.heading = "";
    this.value = "";
  }

  override render() {
    return html`<span class="heading">${this.heading}</span><span class="value">${this.value}</span>`;
  }
}
