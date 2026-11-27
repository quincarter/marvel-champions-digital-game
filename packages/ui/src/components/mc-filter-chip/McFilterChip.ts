import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";

/**
 * # Filter chip
 * A toggle chip: a word, an optional count, on or off. On is an ink fill (a state, not only a color), disabled is
 * dashed. Pressed by a tap only (`shared/tapped.ts`); raises `mc-activate` with its `value`.
 *
 * @element mc-filter-chip
 * @attr label - The word, already translated.
 * @attr count - A number after the word; absent for none.
 * @attr selected - The chip is on.
 * @attr disabled - The chip can't be pressed.
 * @fires mc-activate - `detail.key` is the chip's `value`.
 */
export class McFilterChip extends LitElement {
  static override styles = [
    ThemeStyles,
    css`
      :host {
        display: inline-block;
      }
      button {
        height: 100%;
        min-height: 44px;
        padding: 0 14px;
        font: 800 var(--mc-chip-size, 11px) var(--mc-font-body);
        letter-spacing: 1.2px;
        text-transform: uppercase;
        color: var(--mc-text-ink);
        background: var(--mc-fill-parchment);
        border: 2px solid var(--mc-line-ink);
        border-radius: 0;
        cursor: pointer;
      }
      button[aria-pressed="true"] {
        color: var(--mc-text-paper);
        background: var(--mc-fill-ink);
      }
      button:disabled {
        opacity: 0.4;
        border-style: dashed;
        cursor: default;
      }
      .count {
        margin-left: 6px;
        opacity: 0.75;
      }
    `,
  ];
  static override properties: PropertyDeclarations = {
    label: { type: String },
    count: { type: Number },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    value: { type: String },
  };
  declare label: string;
  declare count: number | undefined;
  declare selected: boolean;
  declare disabled: boolean;
  declare value: string;

  constructor() {
    super();
    this.label = "";
    this.selected = false;
    this.disabled = false;
    this.value = "";
  }

  #activate = (): void => {
    if (this.disabled) return;
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key: this.value }, bubbles: true, composed: true }));
  };

  override render() {
    return html`<button
      type="button"
      tabindex="-1"
      aria-pressed=${this.selected ? "true" : "false"}
      ?disabled=${this.disabled}
      ${tapped(this.#activate)}
    >
      ${this.label}${this.count !== undefined ? html`<span class="count">(${this.count})</span>` : nothing}
    </button>`;
  }
}
