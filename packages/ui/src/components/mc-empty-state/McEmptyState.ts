import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McEmptyStateStyles } from "./mc-empty-state.styles.js";

/**
 * # Empty state
 * The quiet line a list shows when it has nothing to list ("Nothing here yet."). Text only, in the body role at 75% ink,
 * so a screen never leaves an unexplained blank.
 *
 * @element mc-empty-state
 * @attr text - The sentence, already translated.
 * @attr size - Font size in px (14).
 */
export class McEmptyState extends LitElement {
  static override styles = [ThemeStyles, McEmptyStateStyles];

  static override properties: PropertyDeclarations = {
    text: { type: String },
    size: { type: Number },
  };

  declare text: string;
  declare size: number;

  constructor() {
    super();
    this.text = "";
    this.size = 14;
  }

  override render() {
    this.style.setProperty("--mc-empty-size", `${this.size}px`);
    return html`<span>${this.text}</span>`;
  }
}
