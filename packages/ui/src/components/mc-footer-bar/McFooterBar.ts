import { css, html, LitElement } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";

const styles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 14px;
  }
  ::slotted(*) {
    flex: 1 1 0;
    min-width: 0;
  }
  ::slotted([data-wide]) {
    flex-basis: 100%;
  }
`;

/**
 * # Footer bar
 * The row of actions that stays at the foot of a panel while its body scrolls: its children share a row's width, and a
 * child marked `data-wide` takes a row of its own (a primary action over the secondary ones).
 *
 * @element mc-footer-bar
 * @slot - The buttons.
 */
export class McFooterBar extends LitElement {
  static override styles = [ThemeStyles, styles];

  override render() {
    return html`<slot></slot>`;
  }
}
