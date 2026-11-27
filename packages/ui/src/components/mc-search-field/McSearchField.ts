import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import type { McSearchDetail, McSearchFocusDetail, McSubmitDetail } from "./mc-search-field.types.js";
import { McSearchFieldStyles } from "./mc-search-field.styles.js";

/**
 * # Search field
 * A real `<input>` in the panel for a screen search (a rulebook, a deck list, the deck builder): a placeholder, a clear
 * button, and one debounced `mc-search` event with the text. The matching stays in the client (accent-free, fuzzy:
 * `view/deck-search.ts`); this only says what was typed.
 *
 * - **Typing** raises `mc-search` after `debounce` ms of quiet. Nothing fires mid-IME-composition; the composed text
 *   fires when the composition ends.
 * - **Enter** raises `mc-search` at once and leaves the field (the mobile keyboard closes). **Escape** leaves the field,
 *   keeps the text, and stops there, so the same key does not also back out of the screen; with `escape-clears` a
 *   filled field is emptied first (at once, caret kept) and only an empty one is left. The clear button
 *   (a tap, never a swipe lift) empties it, raises `mc-search` at once and keeps the caret.
 * - **Focus** is the screen route own: a pad or keyboard stop calls `focusInput()` (A / Enter on the stop; on touch the
 *   caret in the field opens the on-screen keyboard) and `blurInput()` (B takes the caret out). `mc-search-focus` says
 *   when the caret moves so the route can stand aside while someone types.
 * - **Controlled by the client without fighting the typist:** the `value` property is adopted only when it differs from
 *   what the field already holds, so a redraw with the stale query never resets text or the caret.
 *
 * @element mc-search-field
 * @attr value - The text.
 * @attr placeholder - What it says while empty, already translated.
 * @attr focus-placeholder - What it says while empty and focused (a Steam pad: "Steam + X opens the keyboard"); optional.
 * @attr clear-label - The clear button accessible name, already translated.
 * @attr debounce - The typing pause in ms (200).
 * @attr max-length - The longest text in characters (0: no limit).
 * @attr clearable - Shows the clear button while there is text (on by default).
 * @attr keep-focus - Enter does not take the caret out (a field that submits, like an import link).
 * @attr escape-clears - Escape empties a filled field (firing `mc-search` at once) before it leaves an empty one.
 * @attr size - The typed text px size (16: a phone browser zooms in on anything smaller).
 * @fires mc-search - `McSearchDetail`.
 * @fires mc-submit - `McSubmitDetail`: Enter (after the `mc-search` it raises at once).
 * @fires mc-search-focus - `McSearchFocusDetail`.
 */
export class McSearchField extends LitElement {
  static override styles = [ThemeStyles, McSearchFieldStyles];

  static override properties: PropertyDeclarations = {
    value: { type: String },
    placeholder: { type: String },
    focusPlaceholder: { type: String, attribute: "focus-placeholder" },
    clearLabel: { type: String, attribute: "clear-label" },
    debounce: { type: Number },
    size: { type: Number },
    escapeClears: { type: Boolean, attribute: "escape-clears" },
    maxLength: { type: Number, attribute: "max-length" },
    clearable: { type: Boolean },
    keepFocus: { type: Boolean, attribute: "keep-focus" },
    focused: { state: true },
  };

  declare value: string;
  declare placeholder: string;
  declare focusPlaceholder: string;
  declare clearLabel: string;
  declare debounce: number;
  declare size: number;
  declare escapeClears: boolean;
  declare maxLength: number;
  declare clearable: boolean;
  declare keepFocus: boolean;
  declare focused: boolean;
  /** What the field holds now (the typist own, ahead of the `value` property). */
  #text = "";
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** A debounced `mc-search` is waiting. */
  #pending = false;
  /** The text the last `mc-search` carried, so the same text is not raised twice (an IME's compositionend and input). */
  #emitted = "";
  #composing = false;

  constructor() {
    super();
    this.value = "";
    this.placeholder = "";
    this.focusPlaceholder = "";
    this.clearLabel = "";
    this.debounce = 200;
    this.size = 16;
    this.escapeClears = false;
    this.maxLength = 0;
    this.clearable = true;
    this.keepFocus = false;
    this.focused = false;
  }

  /** True while the caret is in the field. */
  get isFocused(): boolean {
    return this.focused;
  }

  /** What the field holds now: the typist own text, ahead of the `value` property a redraw may hand in stale. */
  get text(): string {
    return this.#text;
  }

  /** Same as `focusInput()`, so a screen that calls `element.focus()` lands in the field. */
  override focus(options?: FocusOptions): void {
    this.#input()?.focus(options);
  }

  /** Puts the caret in the field (a pad or keyboard user pressed A / Enter on its stop). */
  focusInput(): void {
    this.#input()?.focus();
  }

  /** Takes the caret out of the field. */
  blurInput(): void {
    this.#input()?.blur();
  }

  /** The caret leaves (a focus route pad helper takes this name). */
  override blur(): void {
    this.blurInput();
  }

  #input(): HTMLInputElement | null {
    return this.renderRoot.querySelector("input");
  }

  protected override willUpdate(changed: PropertyValues): void {
    // Adopted when the client changes it, or empties a field nobody is typing in (a client clear while a debounce is
    // pending cancels it); never while the typist holds the caret, where a redraw may hand in the stale query.
    const cleared = this.value === "" && this.#text !== "" && !this.focused;
    if ((changed.has("value") || cleared) && this.value !== this.#text) {
      this.#text = this.value;
      this.#emitted = this.value;
      clearTimeout(this.#timer);
      this.#pending = false;
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
  }

  #emit(immediate: boolean): void {
    clearTimeout(this.#timer);
    this.#pending = false;
    if (!immediate && this.#text === this.#emitted) return;
    this.#emitted = this.#text;
    const detail: McSearchDetail = { value: this.#text, immediate };
    this.dispatchEvent(new CustomEvent("mc-search", { detail, bubbles: true, composed: true }));
  }

  #onInput = (event: Event): void => {
    this.#text = (event.target as HTMLInputElement).value;
    this.requestUpdate();
    if (this.#composing) return;
    clearTimeout(this.#timer);
    if (this.debounce <= 0) this.#emit(false);
    else {
      this.#pending = true;
      this.#timer = setTimeout(() => this.#emit(false), this.debounce);
    }
  };

  #onKey = (event: KeyboardEvent): void => {
    if (event.isComposing) return;
    if (event.key !== "Enter" && event.key !== "Escape") return;
    // Stops here: the same key must not also press whatever the screen route has focused or back out of the screen.
    event.stopPropagation();
    if (event.key === "Escape" && this.escapeClears && this.#text !== "") {
      this.#clear();
      return;
    }
    if (event.key === "Enter") {
      this.#emit(true);
      const detail: McSubmitDetail = { value: this.#text };
      this.dispatchEvent(new CustomEvent("mc-submit", { detail, bubbles: true, composed: true }));
      if (this.keepFocus) return;
    }
    this.blurInput();
  };

  #setFocus(focused: boolean): void {
    if (this.focused === focused) return;
    this.focused = focused;
    const detail: McSearchFocusDetail = { focused };
    this.dispatchEvent(new CustomEvent("mc-search-focus", { detail, bubbles: true, composed: true }));
  }

  #clear = (): void => {
    this.#text = "";
    this.requestUpdate();
    this.#emit(true);
    this.focusInput();
  };

  override updated(): void {
    this.style.setProperty("--mc-search-size", `${this.size}px`);
  }

  override render() {
    const hint = this.focused && this.#text === "" && this.focusPlaceholder ? this.focusPlaceholder : this.placeholder;
    return html`
      <input
        type="text"
        inputmode="search"
        enterkeyhint=${this.keepFocus ? "go" : "search"}
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        aria-label=${this.placeholder}
        maxlength=${this.maxLength > 0 ? this.maxLength : nothing}
        placeholder=${hint}
        .value=${this.#text}
        @input=${this.#onInput}
        @keydown=${this.#onKey}
        @compositionstart=${() => {
          this.#composing = true;
        }}
        @compositionend=${(event: Event) => {
          this.#composing = false;
          this.#text = (event.target as HTMLInputElement).value;
          this.#emit(false);
        }}
        @focus=${() => this.#setFocus(true)}
        @blur=${() => {
          // Leaving the field says what was typed, rather than losing it to the pause.
          if (this.#pending) this.#emit(false);
          this.#setFocus(false);
        }}
      />
      ${
        this.#text === "" || !this.clearable
          ? nothing
          : html`<button type="button" class="clear" tabindex="-1" aria-label=${this.clearLabel} ${tapped(this.#clear)}>
              ✕
            </button>`
      }
    `;
  }
}
