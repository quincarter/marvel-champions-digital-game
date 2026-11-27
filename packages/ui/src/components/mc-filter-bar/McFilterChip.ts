import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { tapped } from "../../shared/tapped.js";
import type { McFilterChipModel } from "./mc-filter-bar.types.js";
import { McFilterChipStyles } from "./mc-filter-chip.styles.js";

/**
 * # Filter chip
 * One toggle of a filter bar: a word, an optional count, and a check mark while on (so the state never rests on color).
 * Pressed only by a tap (`shared/tapped.ts`); raises `mc-chip` with the chip id.
 *
 * @element mc-filter-chip
 * @prop model - The chip (`McFilterChipModel`).
 * @attr selected - Reflected from the model, for the stylesheet.
 * @fires mc-chip - `detail.id`: the chip was tapped (not when disabled).
 */
export class McFilterChip extends LitElement {
  static override styles = [ThemeStyles, McFilterChipStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };

  declare model: McFilterChipModel | null;
  declare selected: boolean;
  declare disabled: boolean;

  constructor() {
    super();
    this.model = null;
    this.selected = false;
    this.disabled = false;
  }

  #press = (): void => {
    const m = this.model;
    if (!m || m.disabled) return;
    this.dispatchEvent(new CustomEvent("mc-chip", { detail: { id: m.id }, bubbles: true, composed: true }));
  };

  override willUpdate(): void {
    this.selected = this.model?.selected ?? false;
    this.disabled = this.model?.disabled ?? false;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const style = m.tint ? `--chip-fill:${m.tint.fill};--chip-ink:${m.tint.ink}` : "";
    return html`<button type="button" class="chip" tabindex="-1" style=${style || nothing} ${tapped(this.#press)}>
      ${m.selected ? html`<span aria-hidden="true">✓</span>` : nothing}<span>${m.label}</span>${
        m.count === undefined ? nothing : html`<span class="count">${m.count}</span>`
      }
    </button>`;
  }
}
