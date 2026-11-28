import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { McScenarioStageStyles } from "./mc-scenario-stage.styles.js";

/**
 * # Scenario stage
 * One outlined box of the stages panel: the stage and the villain's name over its scheme, hit points and attack. The
 * stage the draft's difficulty plays is bright and heavy-framed; the other is dim and thin, and says so by its frame
 * as well as its dimness ("used now" against "the other mode").
 *
 * @element mc-scenario-stage
 * @attr name - "I · KLAW", already translated.
 * @attr stats - "SCH 2 · HP 12 · ATK 3", already translated.
 * @attr current - The stage this difficulty plays.
 */
export class McScenarioStage extends LitElement {
  static override styles = [ThemeStyles, McScenarioStageStyles];

  static override properties: PropertyDeclarations = {
    name: { type: String },
    stats: { type: String },
    current: { type: Boolean, reflect: true },
  };

  declare name: string;
  declare stats: string;
  declare current: boolean;

  constructor() {
    super();
    this.name = "";
    this.stats = "";
    this.current = false;
  }

  override render() {
    return html`<span class="title">${this.name}</span><span class="stats">${this.stats}</span>`;
  }
}
