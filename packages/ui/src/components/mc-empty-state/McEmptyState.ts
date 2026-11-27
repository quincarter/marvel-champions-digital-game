import { css, html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";

const styles = css`
  :host {
    display: block;
    padding: 2px 0 8px;
    font-size: 14px;
    line-height: 1.45;
    opacity: 0.85;
    overflow-wrap: anywhere;
  }
  :host([dim]) {
    opacity: 0.7;
  }
`;

/**
 * # Empty state
 * The words a list shows in place of its rows: nothing yet, nothing matches, still loading.
 *
 * @element mc-empty-state
 * @attr text - The words, already translated.
 * @attr dim - Fainter, for "loading" rather than "none".
 */
export class McEmptyState extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = {
    text: { type: String },
    dim: { type: Boolean, reflect: true },
  };

  declare text: string;
  declare dim: boolean;

  constructor() {
    super();
    this.text = "";
    this.dim = false;
  }

  override render() {
    return html`${this.text}`;
  }
}
