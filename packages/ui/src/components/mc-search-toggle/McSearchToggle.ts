import { html, LitElement, svg, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";
import { McSearchToggleStyles } from "./mc-search-toggle.styles.js";

/**
 * # Search toggle
 * A square button with a magnifier that shows or hides a search field (a phone's roster gets the row back). On while the
 * field is shown or holds text. A tap raises `mc-press`; so does a focus stop's `click()`.
 *
 * @element mc-search-toggle
 * @attr label - The accessible name, already translated.
 * @attr selected - The field is shown or filled.
 * @fires mc-press - A tap on the button (from the inner `mc-button`).
 */
export class McSearchToggle extends LitElement {
  static override styles = [ThemeStyles, McSearchToggleStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    selected: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare selected: boolean;

  constructor() {
    super();
    this.label = "";
    this.selected = false;
  }

  /** A focus stop's `click()` (`detail` 0) presses it; a pointer click is the inner button's tap. */
  readonly #keyboardClick = (event: MouseEvent): void => {
    if (event.detail === 0) this.dispatchEvent(new CustomEvent("mc-press", { bubbles: true, composed: true }));
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "button");
    this.addEventListener("click", this.#keyboardClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#keyboardClick);
  }

  protected override updated(): void {
    this.setAttribute("aria-label", this.label);
    this.setAttribute("aria-pressed", this.selected ? "true" : "false");
  }

  override render() {
    return html`<mc-button kind="secondary" ?selected=${this.selected}></mc-button>
      <svg viewBox="0 0 44 44" aria-hidden="true">
        ${svg`<circle cx="20" cy="20" r="7" fill="none" stroke-width="2.5"></circle>
          <line x1="25" y1="25" x2="31" y2="31" stroke-width="3"></line>`}
      </svg>`;
  }
}
