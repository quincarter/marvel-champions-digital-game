import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import { McSearchFieldStyles } from "./mc-search-field.styles.js";

/** How long typing rests before `mc-search` is raised. */
export const SEARCH_DEBOUNCE_MS = 120;

/**
 * # Search field
 * A real text `<input>` with a clear button: what a search box in a panel is. The client matches (fuzzy, accent-free,
 * `view/deck-search.ts`); this only reports what was typed.
 *
 * - Typing raises `mc-search` once typing rests (120ms), never in the middle of an IME composition (it is raised when the
 *   composition ends). Enter raises `mc-search-submit` at once.
 * - Escape clears a field that has text (raising `mc-search` now); on an empty one it leaves the field.
 * - The clear button (a tap, like every press) empties the field and keeps the caret in it.
 * - `focusField()` puts the caret in (a focus stop's press); `focused` says whether it is there. `mc-field-focus` fires
 *   with `detail.focused` as the caret comes and goes, so a screen's pad and key route can stand aside while typing.
 *
 * @element mc-search-field
 * @attr value - What the field holds. Setting it from outside (a Clear) shows at once and raises nothing.
 * @attr placeholder - Already translated.
 * @attr clearLabel - The clear button's name for assistive tech, already translated.
 * @fires mc-search - `detail.value`: the text, debounced.
 * @fires mc-search-submit - `detail.value`: Enter was pressed.
 * @fires mc-field-focus - `detail.focused`.
 */
export class McSearchField extends LitElement {
  static override styles = [ThemeStyles, McSearchFieldStyles];

  static override properties: PropertyDeclarations = {
    value: { type: String },
    placeholder: { type: String },
    clearLabel: { type: String, attribute: "clear-label" },
  };

  declare value: string;
  declare placeholder: string;
  declare clearLabel: string;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #composing = false;

  constructor() {
    super();
    this.value = "";
    this.placeholder = "";
    this.clearLabel = "";
  }

  get #input(): HTMLInputElement | null {
    return this.renderRoot.querySelector("input");
  }

  /** Puts the caret in the field. */
  focusField(): void {
    this.#input?.focus();
  }

  /** Takes the caret out. */
  blurField(): void {
    this.#input?.blur();
  }

  /** Whether the caret is in the field. */
  get focused(): boolean {
    return this.shadowRoot?.activeElement === this.#input && this.#input !== null;
  }

  override updated(): void {
    const input = this.#input;
    // A value set from outside shows; what the player is typing is never overwritten by an older echo of it.
    if (input && input.value !== this.value && !this.#composing) input.value = this.value;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #emit(name: "mc-search" | "mc-search-submit", value: string): void {
    this.dispatchEvent(new CustomEvent(name, { detail: { value }, bubbles: true, composed: true }));
  }

  #typed(): void {
    const input = this.#input;
    if (!input || this.#composing) return;
    this.value = input.value;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#emit("mc-search", this.value);
    }, SEARCH_DEBOUNCE_MS);
  }

  #clear(): void {
    const input = this.#input;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.value = "";
    if (input) input.value = "";
    this.#emit("mc-search", "");
    input?.focus();
  }

  #key(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === "Enter") {
      if (this.#timer !== null) clearTimeout(this.#timer);
      this.#timer = null;
      this.#emit("mc-search-submit", this.#input?.value ?? "");
    } else if (event.key === "Escape") {
      event.stopPropagation();
      if ((this.#input?.value ?? "") !== "") this.#clear();
      else this.#input?.blur();
    }
  }

  #focusChange(focused: boolean): void {
    this.dispatchEvent(new CustomEvent("mc-field-focus", { detail: { focused }, bubbles: true, composed: true }));
  }

  override render() {
    return html`<div class="field">
      <input
        type="text"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        .value=${this.value}
        placeholder=${this.placeholder}
        aria-label=${this.placeholder}
        @input=${() => this.#typed()}
        @compositionstart=${() => (this.#composing = true)}
        @compositionend=${() => {
          this.#composing = false;
          this.#typed();
        }}
        @keydown=${(event: KeyboardEvent) => this.#key(event)}
        @focus=${() => this.#focusChange(true)}
        @blur=${() => this.#focusChange(false)}
      />
      ${
        this.value !== ""
          ? html`<button
              class="clear"
              type="button"
              tabindex="-1"
              aria-label=${this.clearLabel || nothing}
              ${tapped(() => this.#clear())}
            >
              ×
            </button>`
          : nothing
      }
    </div>`;
  }
}
