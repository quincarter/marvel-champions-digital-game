import { html, LitElement, type PropertyDeclarations } from "lit";
import { McStepTicksStyles } from "./mc-step-ticks.styles.js";
import type { McStepTicksProps } from "./mc-step-ticks.types.js";

/**
 * # Step ticks
 * A strip of `count` equal ticks, the first `filled` of them in caution yellow: where the player is in a run of steps. The
 * state is the fill and the `aria-label` ("Lesson 1 of 5"), so it never rests on colour alone: an empty tick is a paler
 * outline-free block, a filled one is solid. Its width is `--ticks-width` (140px), its height `--ticks-height` (10px).
 *
 * @element mc-step-ticks
 * @attr count - How many ticks.
 * @attr filled - How many are filled, from the first.
 * @attr label - The strip's accessible name, already translated.
 */
export class McStepTicks extends LitElement implements McStepTicksProps {
  static override styles = [McStepTicksStyles];

  static override properties: PropertyDeclarations = {
    count: { type: Number },
    filled: { type: Number },
    label: { type: String },
  };

  declare count: number;
  declare filled: number;
  declare label: string;

  constructor() {
    super();
    this.count = 0;
    this.filled = 0;
    this.label = "";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "img");
  }

  protected override updated(): void {
    if (this.label) this.setAttribute("aria-label", this.label);
    else this.removeAttribute("aria-label");
  }

  override render() {
    const ticks = Array.from({ length: Math.max(0, this.count) }, (_, index) => index < this.filled);
    return html`${ticks.map((on) => html`<span class="tick" ?data-on=${on}></span>`)}`;
  }
}
