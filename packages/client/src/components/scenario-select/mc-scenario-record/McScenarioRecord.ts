import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McScenarioRecordStyles } from "./mc-scenario-record.styles.js";
import type { ScenarioRecordTone } from "./mc-scenario-record.types.js";

/**
 * # Scenario record
 * The played record as a filled band at menu-button size so it reads from the couch: win-state green once beaten, a deep
 * red when played but never won, the advisory yellow before it has been played. The tone is the fill and the words say
 * the same thing, so the state never rests on color alone.
 *
 * @element mc-scenario-record
 * @attr label - "RECORD", already translated.
 * @attr tally - "3 wins · 1 loss", or "Not played yet".
 * @attr subline - A second line ("Best clear: round 6"); empty for none.
 * @attr tone - `beaten` | `played` | `unplayed`.
 */
export class McScenarioRecord extends LitElement {
  static override styles = [ThemeStyles, McScenarioRecordStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    tally: { type: String },
    subline: { type: String },
    tone: { type: String, reflect: true },
  };

  declare label: string;
  declare tally: string;
  declare subline: string;
  declare tone: ScenarioRecordTone;

  constructor() {
    super();
    this.label = "";
    this.tally = "";
    this.subline = "";
    this.tone = "unplayed";
  }

  override render() {
    return html`<span class="label">${this.label}</span>
      <div class="band">
        <span class="tally">${this.tally}</span>
        ${this.subline ? html`<span class="subline">${this.subline}</span>` : nothing}
      </div>`;
  }
}
