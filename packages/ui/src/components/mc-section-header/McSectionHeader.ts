import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { SectionHeaderLevel } from "./mc-section-header.types.js";
import { McSectionHeaderStyles } from "./mc-section-header.styles.js";

/**
 * # Section header
 * A Bangers heading with a rule: the title of a block in a list or a panel (the lobby's "The table", the Trophy Room's
 * families). By default the rule runs on from the heading to the end of its line; `underline` draws it under the whole
 * row instead. A `count` ("3 of 7 · 43%") sits at the right end. With `open` set it leads with a chevron saying whether
 * the section is unfolded (a mark and a word, never color alone). Decorative: it takes no press; a folding section's
 * owner lays a tap area over it.
 *
 * @element mc-section-header
 * @attr label - The heading, already translated (drawn in capitals).
 * @attr count - What is under it, already worded; none when empty.
 * @attr size - The heading's font size in px (0: the default for its look, 17 inline, 24 underlined, 13 small).
 * @attr level - large (default) | small | caption: a small heading is the body face, bold, with a hairline rule; a caption is a tiny capitals
 * label (`--mc-section-opacity` sets its strength) that takes the in-line rule.
 * @attr rule - Draws the rule after the heading (on by default; assign `false` for a bare heading).
 * @attr underline - Puts the rule under the row, with the count at its right end, instead of in line.
 * @prop open - A folding section says whether it is unfolded (true shows a down chevron, false a right one); undefined for a plain heading.
 */
export class McSectionHeader extends LitElement {
  static override styles = [ThemeStyles, McSectionHeaderStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    count: { type: String },
    size: { type: Number },
    level: { type: String, reflect: true },
    rule: { type: Boolean },
    underline: { type: Boolean, reflect: true },
    open: { attribute: false },
  };

  declare label: string;
  declare count: string;
  declare size: number;
  declare level: SectionHeaderLevel;
  declare rule: boolean;
  declare underline: boolean;
  declare open: boolean | undefined;

  constructor() {
    super();
    this.label = "";
    this.count = "";
    this.size = 0;
    this.level = "large";
    this.rule = true;
    this.underline = false;
    this.open = undefined;
  }

  override render() {
    const chevron = this.open === undefined ? "" : this.open ? "▾ " : "▸ ";
    const inline = this.rule && !this.underline;
    const classes = ["head", this.level, this.underline ? "under" : inline ? "" : "bare"].filter(Boolean).join(" ");
    return html`<div class=${classes}>
      <span class="label" style=${this.size > 0 ? `font-size:${this.size}px` : nothing}>${chevron}${this.label}</span>
      ${inline ? html`<span class="rule"></span>` : nothing}
      ${this.count ? html`<span class="count">${this.count}</span>` : nothing}
    </div>`;
  }
}
