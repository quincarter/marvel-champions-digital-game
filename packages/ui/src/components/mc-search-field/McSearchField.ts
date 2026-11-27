import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";

const styles = css`
  :host {
    display: block;
    position: relative;
    background: var(--mc-fill-paper);
    box-shadow: inset 0 0 0 2.5px var(--mc-line-ink);
  }
  :host(:focus-within) {
    box-shadow: inset 0 0 0 2.5px var(--mc-line-red, var(--mc-line-ink));
  }
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0 var(--mc-search-pad-right, 12px) 0 12px;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--mc-text-ink);
    font-family: var(--mc-font-body);
    /* 16px: a phone does not zoom the page when the field takes the caret. */
    font-size: 16px;
    appearance: none;
    -webkit-appearance: none;
  }
  input::placeholder {
    color: var(--mc-text-ink);
    opacity: 0.55;
  }
  input::-webkit-search-cancel-button {
    display: none;
  }
  .clear {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-weight: 800;
    font-size: 18px;
    opacity: 0.7;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
`;

/**
 * # Search field
 * A real text `<input>` in the panel: a placeholder, a clear button while there is text, a debounced `mc-search` with
 * the text (never in the middle of an IME composition; it fires when the composition ends), `mc-submit` on Enter,
 * and Escape that clears the text and, with nothing to clear, takes the caret out. Matching stays with the caller.
 * The key and the pad: the caret goes in with `focusInput()`; `focused` and `blurInput()` let the screen's focus route
 * stand aside while typing. 16px text keeps a phone from zooming on focus.
 *
 * @element mc-search-field
 * @attr placeholder - Shown while empty.
 * @attr clear-label - The clear button's accessible name, already translated.
 * @attr debounce - Milliseconds the typing must pause for `mc-search` (default 140).
 * @attr keep-focus - Enter does not take the caret out (a field that submits).
 * @fires mc-search - `detail.text`: the text changed (debounced).
 * @fires mc-submit - `detail.text`: Enter.
 */
export class McSearchField extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = {
    value: { type: String },
    placeholder: { type: String },
    clearLabel: { type: String, attribute: "clear-label" },
    maxLength: { type: Number, attribute: "max-length" },
    debounce: { type: Number },
    keepFocus: { type: Boolean, attribute: "keep-focus" },
    clearable: { type: Boolean },
  };

  declare value: string;
  declare placeholder: string;
  declare clearLabel: string;
  declare maxLength: number;
  declare debounce: number;
  declare keepFocus: boolean;
  declare clearable: boolean;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #composing = false;

  constructor() {
    super();
    this.value = "";
    this.placeholder = "";
    this.clearLabel = "";
    this.maxLength = 80;
    this.debounce = 140;
    this.keepFocus = false;
    this.clearable = true;
  }

  get #input(): HTMLInputElement | null {
    return this.renderRoot.querySelector("input");
  }

  /** The player is typing here: a screen's keyboard and pad route stands aside. */
  get focused(): boolean {
    return this.renderRoot.querySelector("input:focus") !== null;
  }

  focusInput(): void {
    this.#input?.focus();
  }

  blurInput(): void {
    this.#input?.blur();
  }

  /** The caret leaves (the focus route's pad helper takes this name). */
  override blur(): void {
    this.blurInput();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  #emit(name: "mc-search" | "mc-submit"): void {
    this.dispatchEvent(new CustomEvent(name, { detail: { text: this.value }, bubbles: true, composed: true }));
  }

  #changed(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    if (this.#composing) return;
    if (this.debounce <= 0) this.#emit("mc-search");
    else
      this.#timer = setTimeout(() => {
        this.#timer = null;
        this.#emit("mc-search");
      }, this.debounce);
  }

  #clear(): void {
    this.value = "";
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#emit("mc-search");
    this.#input?.focus();
  }

  #key(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === "Enter") {
      // The key does not also press whatever the screen's route has focused.
      event.stopPropagation();
      if (this.#timer) clearTimeout(this.#timer);
      this.#timer = null;
      this.#emit("mc-submit");
      if (!this.keepFocus) this.#input?.blur();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      if (this.value !== "") this.#clear();
      else this.#input?.blur();
    }
  }

  override render() {
    this.style.setProperty("--mc-search-pad-right", this.clearable && this.value !== "" ? "44px" : "12px");
    return html`<input
        type="text"
        enterkeyhint=${this.keepFocus ? "go" : "search"}
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        maxlength=${this.maxLength}
        aria-label=${this.placeholder}
        .value=${this.value}
        placeholder=${this.placeholder}
        @input=${(event: Event) => {
          this.value = (event.target as HTMLInputElement).value;
          this.#changed();
        }}
        @compositionstart=${() => (this.#composing = true)}
        @compositionend=${(event: Event) => {
          this.#composing = false;
          this.value = (event.target as HTMLInputElement).value;
          this.#changed();
        }}
        @keydown=${(event: KeyboardEvent) => this.#key(event)}
      />
      ${
        this.clearable && this.value !== ""
          ? html`<div
              class="clear"
              role="button"
              aria-label=${this.clearLabel || nothing}
              ${tapped(() => this.#clear())}
            >
              ×
            </div>`
          : nothing
      }`;
  }
}
