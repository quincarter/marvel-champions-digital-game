import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { activate, tapOn } from "../../shared/popup-parts.js";
import "../mc-language-option/mc-language-option.js";
import "../mc-popup-button/mc-popup-button.js";
import { McLanguageMenuStyles } from "./mc-language-menu.styles.js";
import type { LanguageMenuModel } from "./mc-language-menu.types.js";

/**
 * # Language menu
 * What the card language button opens: a dropdown of languages under the button, or on a native install the "Other
 * languages" note with its links. A scrim dims the screen under it; a tap on the scrim is the way out.
 *
 * @element mc-language-menu
 * @attr phone - A phone layout (reflected from the model).
 * @fires mc-activate - `detail.key`: a language, a link, the close button, or `outside` (the scrim was tapped).
 */
export class McLanguageMenu extends LitElement {
  static override styles = [ThemeStyles, McLanguageMenuStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: LanguageMenuModel | null;
  declare phone: boolean;
  #stopScrim: (() => void) | null = null;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  override willUpdate(): void {
    const m = this.model;
    this.phone = m?.phone ?? false;
    // The model's numbers reach the stylesheet as custom properties, so the CSS owns every rule.
    if (!m) return;
    this.style.setProperty("--mc-scrim", String(m.scrim));
    this.style.setProperty("--box-x", `${m.box.x}px`);
    this.style.setProperty("--box-y", `${m.box.y}px`);
    this.style.setProperty("--box-w", `${m.box.width}px`);
    this.style.setProperty("--row-h", `${m.rowHeight}px`);
  }

  override updated(): void {
    if (this.#stopScrim) return;
    this.#stopScrim = tapOn(this.renderRoot.querySelector(".scrim"), () => activate(this, "outside"));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopScrim?.();
    this.#stopScrim = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="scrim"></div>
      ${m.mode === "list" ? this.#list(m) : this.#note(m)}`;
  }

  #list(m: LanguageMenuModel) {
    return html`<div class="list">
      ${m.rows.map((row) => html`<mc-language-option .option=${row}></mc-language-option>`)}
    </div>`;
  }

  #note(m: LanguageMenuModel) {
    const note = m.note;
    if (!note) return nothing;
    return html`<div class="note">
      <div class="head">
        <span class="title">${note.title}</span>
        <div class="close"><mc-popup-button .button=${note.close}></mc-popup-button></div>
      </div>
      ${note.paragraphs.map((text) => html`<p>${text}</p>`)}
      <div class="links">${note.links.map((link) => html`<mc-popup-button .button=${link}></mc-popup-button>`)}</div>
    </div>`;
  }
}
