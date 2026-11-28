import { html, LitElement, type PropertyDeclarations } from "lit";
import { McProgressBarStyles } from "./mc-progress-bar.styles.js";
import type { McProgressBarProps } from "./mc-progress-bar.types.js";

/**
 * # Progress bar
 * A thin outlined track with a Hero Red fill, for how far along something is (the rank toward the next, an
 * achievement's count). The track takes the colour of the words around it. The width is the parent's, the height
 * `--mc-progress-height` (10px). It carries no words: `label` is only what a screen reader hears.
 *
 * @element mc-progress-bar
 * @attr fraction - 0 to 1.
 * @attr label - The accessible description, already translated.
 * @cssprop --mc-progress-height - The track's height.
 */
export class McProgressBar extends LitElement implements McProgressBarProps {
  static override styles = [McProgressBarStyles];

  static override properties: PropertyDeclarations = {
    fraction: { type: Number, reflect: true },
    label: { type: String },
    empty: { type: Boolean, reflect: true },
  };

  declare fraction: number;
  declare label: string;
  declare empty: boolean;

  constructor() {
    super();
    this.fraction = 0;
    this.label = "";
    this.empty = true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "progressbar");
    this.setAttribute("aria-valuemin", "0");
    this.setAttribute("aria-valuemax", "100");
  }

  protected override willUpdate(): void {
    this.empty = !(this.fraction > 0);
  }

  protected override updated(): void {
    const share = Math.min(1, Math.max(0, Number.isFinite(this.fraction) ? this.fraction : 0));
    this.style.setProperty("--mc-progress", String(share));
    this.setAttribute("aria-valuenow", String(Math.round(share * 100)));
    if (this.label) this.setAttribute("aria-label", this.label);
    else this.removeAttribute("aria-label");
  }

  override render() {
    return html`<div class="track"><div class="fill"></div></div>`;
  }
}
