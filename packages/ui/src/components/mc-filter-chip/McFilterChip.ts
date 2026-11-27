import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";

/**
 * # Filter chip
 * A toggle chip: a tag (or a creator, or Clear) that narrows a list. Chosen it reads "✓ tag" and unchosen "tag 3" with
 * the count of what it would leave, so the state never rests on colour alone. It is an `mc-button` with those words.
 *
 * @element mc-filter-chip
 * @attr label - The chip's name, already translated.
 * @attr count - How many items it matches (shown when it is not chosen; none when absent).
 * @attr selected - Chosen.
 * @attr mark - Puts "✓ " before a chosen chip's name (on by default; off for a chip that has its own mark, like "by X ✕").
 * @attr size - The label's size in px (11).
 * @fires mc-press - A tap on the chip.
 */
export class McFilterChip extends LitElement {
  static override styles = [ThemeStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    count: { type: Number },
    selected: { type: Boolean, reflect: true },
    mark: { type: Boolean },
    size: { type: Number },
  };

  declare label: string;
  declare count: number | undefined;
  declare selected: boolean;
  declare mark: boolean;
  declare size: number;

  constructor() {
    super();
    this.label = "";
    this.count = undefined;
    this.selected = false;
    this.mark = true;
    this.size = 11;
  }

  /** The words on the chip. */
  get text(): string {
    if (this.selected) return this.mark ? `✓ ${this.label}` : this.label;
    return this.count === undefined ? this.label : `${this.label} ${this.count}`;
  }

  override render() {
    return html`<mc-button
      kind="secondary"
      style=${`--mc-button-size:${this.size}px;display:block;width:100%;height:100%`}
      .label=${this.text}
      ?selected=${this.selected}
      aria-pressed=${this.selected ? "true" : "false"}
    ></mc-button>`;
  }
}
