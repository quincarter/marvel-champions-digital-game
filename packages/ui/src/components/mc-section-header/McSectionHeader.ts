import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McSectionHeaderStyles } from "./mc-section-header.styles.js";

/**
 * # Section header
 * A Bangers heading with a rule running on to the end of its line: the title of a block in a list or a panel (the
 * lobby's "The table", "Undo"). Decorative: it takes no press.
 *
 * @element mc-section-header
 * @attr label - The heading, already translated (drawn in capitals).
 * @attr size - The heading's font size in px (17).
 * @attr rule - Draws the rule after the heading (on by default; assign `false` for a bare heading).
 */
export class McSectionHeader extends LitElement {
  static override styles = [ThemeStyles, McSectionHeaderStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    size: { type: Number },
    rule: { type: Boolean },
  };

  declare label: string;
  declare size: number;
  declare rule: boolean;

  constructor() {
    super();
    this.label = "";
    this.size = 17;
    this.rule = true;
  }

  override render() {
    return html`<span class="label" style=${`font-size:${this.size}px`}>${this.label}</span>${
        this.rule ? html`<span class="rule"></span>` : nothing
      }`;
  }
}
