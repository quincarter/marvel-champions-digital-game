import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";

/**
 * # Search field
 * A real `<input>` for filtering a list, with a clear button. It raises a debounced `mc-search` as the player types
 * (never in the middle of an IME composition) and at once on clear or Enter. Escape clears a filled field, then leaves
 * an empty one. The mobile keyboard gets `inputmode="search"` and a Search key. Matching is the owner's: this only
 * says what was typed (the client matches with its fuzzy, accent-free search, never a plain `includes`).
 *
 * @element mc-search-field
 * @attr value - The text in the field.
 * @attr placeholder - The hint, already translated.
 * @attr clear-label - The clear button's accessible name, already translated.
 * @attr debounce - Milliseconds to wait after the last keystroke (200).
 * @fires mc-search - `detail.value`, `detail.immediate` (true for a clear or Enter).
 */
export class McSearchField extends LitElement {
  static override styles = [
    ThemeStyles,
    css`
      :host {
        display: block;
        position: relative;
      }
      input {
        width: 100%;
        height: 100%;
        min-height: 44px;
        padding: 0 44px 0 12px;
        font: 400 var(--mc-search-size, 14px) var(--mc-font-body);
        color: var(--mc-text-ink);
        background: var(--mc-fill-paper);
        border: 2.5px solid var(--mc-line-ink);
        border-radius: 0;
        outline: none;
      }
      input:focus-visible {
        box-shadow: 0 0 0 3px var(--mc-line-red);
      }
      input::placeholder {
        color: var(--mc-text-ink);
        opacity: 0.5;
      }
      .clear {
        position: absolute;
        top: 0;
        right: 0;
        width: 44px;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font: 800 16px var(--mc-font-body);
        cursor: pointer;
        user-select: none;
      }
    `,
  ];
  static override properties: PropertyDeclarations = {
    value: { type: String },
    placeholder: { type: String },
    clearLabel: { type: String, attribute: "clear-label" },
    debounce: { type: Number },
  };
  declare value: string;
  declare placeholder: string;
  declare clearLabel: string;
  declare debounce: number;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #composing = false;

  constructor() {
    super();
    this.value = "";
    this.placeholder = "";
    this.clearLabel = "Clear";
    this.debounce = 200;
  }

  override focus(options?: FocusOptions): void {
    this.renderRoot.querySelector("input")?.focus(options);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
  }

  #emit(immediate: boolean): void {
    clearTimeout(this.#timer);
    this.dispatchEvent(
      new CustomEvent("mc-search", { detail: { value: this.value, immediate }, bubbles: true, composed: true }),
    );
  }

  #input = (event: Event): void => {
    this.value = (event.target as HTMLInputElement).value;
    // A composition (an IME choosing characters) is not a query yet: wait for its end.
    if (this.#composing) return;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#emit(false), this.debounce);
  };

  #clear = (): void => {
    this.value = "";
    this.#emit(true);
    this.focus();
  };

  #key = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      if (this.value !== "") {
        this.#clear();
        event.stopPropagation();
      } else (event.target as HTMLInputElement).blur();
    } else if (event.key === "Enter" && !this.#composing) {
      this.#emit(true);
      (event.target as HTMLInputElement).blur();
    }
  };

  override render() {
    return html`<input
        type="search"
        .value=${this.value}
        placeholder=${this.placeholder}
        aria-label=${this.placeholder}
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        @input=${this.#input}
        @keydown=${this.#key}
        @compositionstart=${() => (this.#composing = true)}
        @compositionend=${(event: Event) => {
          this.#composing = false;
          this.#input(event);
        }}
      />
      ${
        this.value !== ""
          ? html`<span class="clear" role="button" aria-label=${this.clearLabel} ${tapped(this.#clear)}>✕</span>`
          : nothing
      }`;
  }
}
