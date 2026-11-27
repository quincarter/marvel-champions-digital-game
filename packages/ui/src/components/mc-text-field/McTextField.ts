import { html, LitElement, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { McFieldFocusDetail, McInputDetail } from "./mc-text-field.types.js";
import { McTextFieldStyles } from "./mc-text-field.styles.js";

/**
 * # Text field
 * A real `<input>` (one line) or `<textarea>` (`multiline`) in the panel, for a pasted decklist, a link or a name. Unlike
 * `mc-search-field` it has no clear button and raises `mc-input` on every change (the screen keeps the text itself), and
 * it is IME-safe: nothing fires mid-composition.
 *
 * - **Escape** leaves the field (keeps the text) and stops there, so it does not also back out of the screen. **Enter**
 *   leaves a one-line field; in a multiline field it is a new line.
 * - **Focus** belongs to the route: a stop calls `focusInput()` / `blurInput()`; `mc-field-focus` says when the caret moves.
 * - The `value` property is adopted only when it differs from what the field holds, so a redraw never resets the caret.
 *
 * @element mc-text-field
 * @attr value - The text.
 * @attr placeholder - What it says while empty, already translated.
 * @attr multiline - A textarea.
 * @attr size - The typed text px size (16: a phone browser zooms in on anything smaller).
 * @fires mc-input - `McInputDetail`.
 * @fires mc-field-focus - `McFieldFocusDetail`.
 */
export class McTextField extends LitElement {
  static override styles = [ThemeStyles, McTextFieldStyles];

  static override properties: PropertyDeclarations = {
    value: { type: String },
    placeholder: { type: String },
    multiline: { type: Boolean, reflect: true },
    size: { type: Number },
    focused: { state: true },
  };

  declare value: string;
  declare placeholder: string;
  declare multiline: boolean;
  declare size: number;
  declare focused: boolean;
  #text = "";
  #composing = false;

  constructor() {
    super();
    this.value = "";
    this.placeholder = "";
    this.multiline = false;
    this.size = 16;
    this.focused = false;
  }

  get isFocused(): boolean {
    return this.focused;
  }

  focusInput(): void {
    this.#field()?.focus();
  }

  blurInput(): void {
    this.#field()?.blur();
  }

  #field(): HTMLInputElement | HTMLTextAreaElement | null {
    return this.renderRoot.querySelector("input, textarea");
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value") && this.value !== this.#text) this.#text = this.value;
  }

  #emit(): void {
    const detail: McInputDetail = { value: this.#text };
    this.dispatchEvent(new CustomEvent("mc-input", { detail, bubbles: true, composed: true }));
  }

  #onInput = (event: Event): void => {
    this.#text = (event.target as HTMLInputElement).value;
    if (!this.#composing) this.#emit();
  };

  #onKey = (event: KeyboardEvent): void => {
    if (event.isComposing) return;
    if (event.key === "Escape" || (event.key === "Enter" && !this.multiline)) {
      // Stops here: the same key must not also press whatever the screen route has focused or back out of the screen.
      event.stopPropagation();
      this.blurInput();
    }
  };

  #setFocus(focused: boolean): void {
    if (this.focused === focused) return;
    this.focused = focused;
    const detail: McFieldFocusDetail = { focused };
    this.dispatchEvent(new CustomEvent("mc-field-focus", { detail, bubbles: true, composed: true }));
  }

  override render() {
    this.style.setProperty("--mc-field-size", `${this.size}px`);
    return this.multiline
      ? html`<textarea
          aria-label=${this.placeholder}
          placeholder=${this.placeholder}
          spellcheck="false"
          autocapitalize="off"
          .value=${this.#text}
          @input=${this.#onInput}
          @keydown=${this.#onKey}
          @compositionstart=${() => (this.#composing = true)}
          @compositionend=${(event: Event) => {
            this.#composing = false;
            this.#text = (event.target as HTMLTextAreaElement).value;
            this.#emit();
          }}
          @focus=${() => this.#setFocus(true)}
          @blur=${() => this.#setFocus(false)}
        ></textarea>`
      : html`<input
          type="text"
          enterkeyhint="done"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          aria-label=${this.placeholder}
          placeholder=${this.placeholder}
          .value=${this.#text}
          @input=${this.#onInput}
          @keydown=${this.#onKey}
          @compositionstart=${() => (this.#composing = true)}
          @compositionend=${(event: Event) => {
            this.#composing = false;
            this.#text = (event.target as HTMLInputElement).value;
            this.#emit();
          }}
          @focus=${() => this.#setFocus(true)}
          @blur=${() => this.#setFocus(false)}
        />`;
  }
}
