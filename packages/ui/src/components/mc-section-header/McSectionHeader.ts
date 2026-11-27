import { css, html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";

const styles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    line-height: 12px;
  }
  span {
    opacity: var(--mc-section-opacity, 0.6);
  }
  :host([rule])::after {
    content: "";
    flex: 1;
    height: 2px;
    background: var(--mc-fill-ink);
  }
`;

/**
 * # Section header
 * A small capitals label that titles a section of a panel ("Deck stats", "Cards"), optionally with a rule filling the
 * rest of its row. `--mc-section-opacity` sets the label's strength.
 *
 * @element mc-section-header
 * @attr label - The title, already translated.
 * @attr rule - A rule fills the rest of the row.
 */
export class McSectionHeader extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    rule: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare rule: boolean;

  constructor() {
    super();
    this.label = "";
    this.rule = false;
  }

  override render() {
    return html`<span>${this.label}</span>`;
  }
}
