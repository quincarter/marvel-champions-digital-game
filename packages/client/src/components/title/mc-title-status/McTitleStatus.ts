import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { TitleStatusInput } from "./mc-title-status.types.js";
import { McTitleStatusStyles } from "./mc-title-status.styles.js";

/**
 * # Title status line
 * One line of words on the Title, in plain text: a status above the footer, or a problem at the top of the screen. It is
 * read out as it appears.
 *
 * @element mc-title-status
 * @prop input - The words and which kind they are (`TitleStatusInput`).
 * @attr kind - status | problem (reflected).
 */
export class McTitleStatus extends LitElement {
  static override styles = McTitleStatusStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    kind: { type: String, reflect: true },
  };

  declare input: TitleStatusInput | null;
  declare kind: "status" | "problem";

  constructor() {
    super();
    this.input = null;
    this.kind = "status";
  }

  protected override willUpdate(): void {
    this.kind = this.input?.kind ?? "status";
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<span role="status">${input.text}</span>`;
  }
}
