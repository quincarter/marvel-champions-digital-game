import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McEmptyStateStyles } from "./mc-empty-state.styles.js";

/**
 * # Empty state
 * What a list says when it has nothing to show: still reading, nothing yet, nothing matches. A message in the body role
 * at 75% ink and an optional smaller second line, so a screen never leaves an unexplained blank.
 *
 * @element mc-empty-state
 * @attr message - The sentence, already translated.
 * @attr detail - An optional smaller line under it.
 * @attr size - The message's font size in px (14).
 * @attr align - start (default) | center.
 */
export class McEmptyState extends LitElement {
  static override styles = [ThemeStyles, McEmptyStateStyles];

  static override properties: PropertyDeclarations = {
    message: { type: String },
    detail: { type: String },
    size: { type: Number },
    align: { type: String, reflect: true },
  };

  declare message: string;
  declare detail: string;
  declare size: number;
  declare align: "start" | "center";

  constructor() {
    super();
    this.message = "";
    this.detail = "";
    this.size = 14;
    this.align = "start";
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("size")) this.style.setProperty("--mc-empty-size", `${this.size}px`);
  }

  override render() {
    return html`<div class="message" role="status">${this.message}</div>
      ${this.detail ? html`<div class="detail">${this.detail}</div>` : nothing}`;
  }
}
