import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-button/mc-button.js";
import "../mc-filter-chip/mc-filter-chip.js";
import { McTipChipStyles } from "./mc-tip-chip.styles.js";

/**
 * # Tip chip
 * A filter chip that may carry a second segment, a button of its own (the aspect chips' "i"), whose press opens a tip
 * about the chip rather than filtering by it. The body is an `mc-filter-chip` (chosen reads "✓ name", unchosen "name 3"
 * with its count, so state never rests on colour alone); the segment is an `mc-button` labelled "i", chosen while its tip
 * is open. Both are pressed by a tap only, and each takes a focus-stop key, so Enter on a stop is a press.
 *
 * @element mc-tip-chip
 * @attr label - The chip's name, already translated.
 * @attr count - How many items it matches, shown while it is not chosen; none when absent.
 * @attr selected - Chosen.
 * @attr disabled - Unavailable; `reason` says why, as a tooltip.
 * @attr reason - The tooltip of a disabled chip.
 * @attr mark - A check before a chosen chip's name (on by default).
 * @attr size - The label size in px (11).
 * @attr value - What the events report as `detail.key`.
 * @attr info-label - The "i" segment's accessible name; no segment while empty.
 * @attr info-open - The "i" is chosen (its tip is open).
 * @attr stop - The body's focus stop key (`data-stop`).
 * @attr info-stop - The "i"'s focus stop key.
 * @prop tint - Rest colors (`fill`, `ink`: CSS colors): an aspect chip in its printed frame color.
 * @fires mc-activate - A tap on an available chip body: `detail.key` is `value`.
 * @fires mc-info - A tap on the "i" segment: `detail.key` is `value`.
 */
export class McTipChip extends LitElement {
  static override styles = [ThemeStyles, McTipChipStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    count: { type: Number },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    reason: { type: String },
    mark: { type: Boolean },
    size: { type: Number },
    value: { type: String },
    infoLabel: { type: String, attribute: "info-label" },
    infoOpen: { type: Boolean, attribute: "info-open" },
    stop: { type: String },
    infoStop: { type: String, attribute: "info-stop" },
    tint: { attribute: false },
  };

  declare label: string;
  declare count: number | undefined;
  declare selected: boolean;
  declare disabled: boolean;
  declare reason: string;
  declare mark: boolean;
  declare size: number;
  declare value: string;
  declare infoLabel: string;
  declare infoOpen: boolean;
  declare stop: string;
  declare infoStop: string;
  declare tint: { readonly fill: string; readonly ink: string } | undefined;

  constructor() {
    super();
    this.label = "";
    this.count = undefined;
    this.selected = false;
    this.disabled = false;
    this.reason = "";
    this.mark = true;
    this.size = 11;
    this.value = "";
    this.infoLabel = "";
    this.infoOpen = false;
    this.stop = "";
    this.infoStop = "";
    this.tint = undefined;
  }

  /** The "i" segment, or null: where a tip points. */
  get infoElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".info");
  }

  #emit(name: "mc-activate" | "mc-info"): void {
    this.dispatchEvent(new CustomEvent(name, { detail: { key: this.value }, bubbles: true, composed: true }));
  }

  override render() {
    const tint = this.tint;
    const body = {
      "--mc-button-size": `${this.size}px`,
      ...(tint ? { "--mc-tint-fill": tint.fill, "--mc-tint-ink": tint.ink } : {}),
    };
    const info = tint
      ? { "--mc-tint-fill": `color-mix(in srgb, ${tint.fill} 78%, black)`, "--mc-tint-ink": tint.ink }
      : {};
    return html`<mc-filter-chip
        class="main"
        data-stop=${this.stop || nothing}
        style=${styleMap(body)}
        .label=${this.label}
        .count=${this.count}
        .mark=${this.mark}
        .size=${this.size}
        .tint=${tint}
        .reason=${this.reason}
        ?selected=${this.selected}
        ?disabled=${this.disabled}
        @mc-activate=${(event: Event) => {
          event.stopPropagation();
          this.#emit("mc-activate");
        }}
        @click=${(event: MouseEvent) => {
          // Enter on the stop is `click()` on this host with no pointer (`detail` 0); a pointer press is the inner button's tap.
          if (event.detail === 0 && event.composedPath()[0] === event.currentTarget && !this.disabled)
            this.#emit("mc-activate");
        }}
      ></mc-filter-chip>
      ${
        this.infoLabel
          ? html`<mc-button
              class="info"
              kind="secondary"
              label="i"
              data-stop=${this.infoStop || nothing}
              style=${styleMap(info)}
              aria-label=${this.infoLabel}
              ?selected=${this.infoOpen}
              @mc-press=${(event: Event) => {
                event.stopPropagation();
                this.#emit("mc-info");
              }}
            ></mc-button>`
          : nothing
      }`;
  }
}
