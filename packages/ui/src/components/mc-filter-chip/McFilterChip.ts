import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";

/**
 * # Filter chip
 * A toggle chip: a tag (or a creator, or Clear) that narrows a list. Chosen it reads "✓ tag" and unchosen "tag 3" with
 * the count of what it would leave, so the state never rests on colour alone. It is an `mc-button` with those words, so
 * a press follows the tap rule; chosen is the ink fill, disabled is dashed.
 *
 * @element mc-filter-chip
 * @attr label - The chip name, already translated.
 * @attr count - How many items it matches (shown when it is not chosen; none when absent).
 * @attr count-always - Show the count on a chosen chip too ("✓ tag 3").
 * @attr selected - Chosen.
 * @attr disabled - Unavailable; `reason` says why, as a tooltip.
 * @attr mark - Puts "✓ " before a chosen chip name (on by default; off for a chip with its own mark, like "by X ✕").
 * @attr size - The label size in px (11).
 * @prop tint - Rest colors (`fill`, `ink`: CSS colors), an aspect chip in its printed frame color.
 * @attr value - What `mc-activate` reports as `detail.key`.
 * @fires mc-activate - A tap on an available chip: `detail.key` is `value`.
 */
export class McFilterChip extends LitElement {
  static override styles = [ThemeStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    count: { type: Number },
    countAlways: { type: Boolean, attribute: "count-always" },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    reason: { type: String },
    mark: { type: Boolean },
    size: { type: Number },
    value: { type: String },
    tint: { attribute: false },
  };

  declare label: string;
  declare count: number | undefined;
  declare countAlways: boolean;
  declare selected: boolean;
  declare disabled: boolean;
  declare reason: string;
  declare mark: boolean;
  declare size: number;
  declare value: string;
  /** Rest colors (CSS): the fill and the word's ink; chosen and hover look as any chip. */
  declare tint: { readonly fill: string; readonly ink: string } | undefined;

  constructor() {
    super();
    this.label = "";
    this.count = undefined;
    this.countAlways = false;
    this.selected = false;
    this.disabled = false;
    this.reason = "";
    this.mark = true;
    this.size = 11;
    this.value = "";
    this.tint = undefined;
  }

  /** The words on the chip. */
  get text(): string {
    const check = this.selected && this.mark ? "✓ " : "";
    const count = this.count !== undefined && (!this.selected || this.countAlways) ? ` ${this.count}` : "";
    return `${check}${this.label}${count}`;
  }

  /** A focus stop `click()` (`detail` 0) toggles the chip like a tap; a pointer click is the inner button's tap. */
  readonly #keyboardClick = (event: MouseEvent): void => {
    if (event.detail !== 0 || this.disabled) return;
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key: this.value }, bubbles: true, composed: true }));
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.#keyboardClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#keyboardClick);
  }

  override render() {
    return html`<mc-button
      kind="secondary"
      style=${`--mc-button-size:${this.size}px;display:block;width:100%;height:100%${this.tint ? `;--mc-tint-fill:${this.tint.fill};--mc-tint-ink:${this.tint.ink}` : ""}`}
      .label=${this.text}
      .reason=${this.reason}
      ?selected=${this.selected}
      ?disabled=${this.disabled}
      aria-pressed=${this.selected ? "true" : "false"}
      @mc-press=${(event: Event) => {
        event.stopPropagation();
        this.dispatchEvent(
          new CustomEvent("mc-activate", { detail: { key: this.value }, bubbles: true, composed: true }),
        );
      }}
    ></mc-button>`;
  }
}
