import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { SectionHeaderSize } from "../../shared/display.types.js";

/**
 * # Section header
 * A heading over a rule, with a count at the right: a Trophy Room family, a Stats section, a pack inside a list. With
 * `open` set it leads with a chevron saying whether the section is unfolded (a word and a mark, never color alone).
 * Presentational: pressing it is the owner's (a tap area over it).
 *
 * @element mc-section-header
 * @attr heading - The title (shown in capitals).
 * @attr count - What is under it ("3 of 7 · 43%"), already worded.
 * @attr size - large | small.
 * @attr open - "true" | "false" for a folding section; absent for a plain one.
 */
export class McSectionHeader extends LitElement {
  static override styles = [
    ThemeStyles,
    css`
      :host {
        display: block;
      }
      .head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        height: 100%;
        padding: 0 0 6px;
        border-bottom: 2px solid var(--mc-line-ink);
      }
      .head.small {
        border-bottom: 1px solid color-mix(in srgb, var(--mc-line-ink) 50%, transparent);
        padding-bottom: 4px;
      }
      .title {
        font-family: var(--mc-font-display);
        font-size: var(--mc-section-size, 24px);
        letter-spacing: 1px;
        text-transform: uppercase;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .small .title {
        font-family: var(--mc-font-body);
        font-weight: 800;
        font-size: 13px;
        letter-spacing: 0;
      }
      .count {
        font-family: var(--mc-font-body);
        font-weight: 800;
        font-size: 13px;
        opacity: 0.75;
        white-space: nowrap;
      }
    `,
  ];
  static override properties: PropertyDeclarations = {
    heading: { type: String },
    count: { type: String },
    size: { type: String, reflect: true },
    open: { type: String, reflect: true },
  };
  declare heading: string;
  declare count: string;
  declare size: SectionHeaderSize;
  declare open: "true" | "false" | undefined;

  constructor() {
    super();
    this.heading = "";
    this.count = "";
    this.size = "large";
  }

  override render() {
    const chevron = this.open === undefined ? "" : this.open === "true" ? "▾ " : "▸ ";
    return html`<div class="head ${this.size}">
      <span class="title">${chevron}${this.heading}</span>
      ${this.count ? html`<span class="count">${this.count}</span>` : nothing}
    </div>`;
  }
}
