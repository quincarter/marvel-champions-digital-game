import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import { McAspectChipStyles } from "./mc-aspect-chip.styles.js";

/**
 * # Aspect chip
 * The aspect badge the Phaser screens draw (`ui/aspect-chips.ts`) as a web component: the aspect's frame color with
 * its translated name on it (never color alone). Decorative by default (no role); with `pressable` it is a button
 * pressed only by a tap (`shared/tapped.ts`) and raises `mc-activate`.
 *
 * @element mc-aspect-chip
 * @attr aspect - justice | aggression | leadership | protection | pool | basic: picks the fill and the word's ink.
 * @attr label - The aspect's name, already translated.
 * @attr height - The chip's height in px (18).
 * @attr size - The label's font size in px (10).
 * @attr pressable - Makes the chip a button.
 * @fires mc-activate - A tap on a pressable chip; `detail.key` is its `value`.
 */
export class McAspectChip extends LitElement {
  static override styles = [ThemeStyles, McAspectChipStyles];

  static override properties: PropertyDeclarations = {
    aspect: { type: String, reflect: true },
    label: { type: String },
    height: { type: Number },
    size: { type: Number },
    pressable: { type: Boolean, reflect: true },
    value: { type: String },
  };

  declare aspect: string;
  declare label: string;
  declare height: number;
  declare size: number;
  declare pressable: boolean;
  declare value: string;

  constructor() {
    super();
    this.aspect = "basic";
    this.label = "";
    this.height = 18;
    this.size = 10;
    this.pressable = false;
    this.value = "";
  }

  #activate = (): void => {
    this.dispatchEvent(new CustomEvent("mc-activate", { detail: { key: this.value }, bubbles: true, composed: true }));
  };

  override render() {
    const style = [
      `--chip-fill:var(--mc-fill-${this.aspect}, var(--mc-fill-spent))`,
      `--chip-ink:var(--mc-text-on-${this.aspect}, var(--mc-text-ink))`,
      `--chip-height:${this.height}px`,
      `--chip-size:${this.size}px`,
    ].join(";");
    return this.pressable
      ? html`<button type="button" class="chip" tabindex="-1" style=${style} ${tapped(this.#activate)}>
          ${this.label}
        </button>`
      : html`<span class="chip" style=${style}>${this.label}</span>`;
  }
}
