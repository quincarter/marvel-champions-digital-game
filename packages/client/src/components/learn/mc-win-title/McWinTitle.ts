import { html, LitElement, type PropertyDeclarations } from "lit";
import { McWinTitleStyles } from "./mc-win-title.styles.js";
import type { WinTitleProps } from "./mc-win-title.types.js";

/**
 * # Win title
 * How to win's two-line headline: the first line in ink ("ONE WAY TO WIN."), the second in Hero Red ("TWO WAYS TO LOSE.").
 *
 * @element mc-win-title
 * @attr first - The first line, already translated.
 * @attr second - The second line, already translated.
 */
export class McWinTitle extends LitElement implements WinTitleProps {
  static override styles = [McWinTitleStyles];

  static override properties: PropertyDeclarations = {
    first: { type: String },
    second: { type: String },
  };

  declare first: string;
  declare second: string;

  constructor() {
    super();
    this.first = "";
    this.second = "";
  }

  override render() {
    return html`<h2 class="line">${this.first}</h2>
      <h2 class="line lose">${this.second}</h2>`;
  }
}
