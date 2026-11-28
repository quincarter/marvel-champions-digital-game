import { html, LitElement, nothing, svg, type PropertyDeclarations } from "lit";
import type { TitlePromoInput } from "./mc-title-promo.types.js";
import { McTitlePromoStyles } from "./mc-title-promo.styles.js";

/** The table of four seats joined by a line, the first filled (you): decoration for the spare room of the side panel. */
const seats = svg`<svg class="seats" viewBox="0 0 220 48" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <line x1="28" y1="24" x2="192" y2="24" stroke="var(--mc-line-ink)" stroke-width="3"></line>
  ${[0, 1, 2, 3].map(
    (i) =>
      svg`<circle cx=${28 + i * 54.67} cy="24" r="14" fill=${i === 0 ? "var(--mc-fill-ink)" : "var(--mc-fill-paper)"} stroke="var(--mc-line-ink)" stroke-width="3"></circle>`,
  )}
</svg>`;

/**
 * # Title promo panel
 * The "Play online" feature panel (an entry point only: nothing connects until a choice is made on its screen): a comic
 * caption box with the title, a pitch, an "N live" chip and Host / Join buttons, each a focus stop. It dims and its
 * buttons are unavailable while offline.
 *
 * @element mc-title-promo
 * @prop input - What it says (`TitlePromoInput`).
 * @attr variant - side | art (reflected).
 * @attr unavailable - Offline (reflected).
 * @fires mc-press - From a button, keyed by its `data-stop`.
 */
export class McTitlePromo extends LitElement {
  static override styles = McTitlePromoStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    variant: { type: String, reflect: true },
    unavailable: { type: Boolean, reflect: true },
  };

  declare input: TitlePromoInput | null;
  declare variant: "side" | "art";
  declare unavailable: boolean;

  constructor() {
    super();
    this.input = null;
    this.variant = "art";
    this.unavailable = false;
  }

  protected override willUpdate(): void {
    this.variant = this.input?.variant ?? "art";
    this.unavailable = this.input ? !this.input.available : false;
  }

  /** "PLAY ONLINE!" on one line, or "PLAY" over "ONLINE!" in the side panel. */
  #title(input: TitlePromoInput): string {
    const upper = input.title.toUpperCase();
    const cut = upper.lastIndexOf(" ");
    return input.variant === "side" && cut > 0 ? `${upper.slice(0, cut)}\n${upper.slice(cut + 1)}!` : `${upper}!`;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const chip = input.live ? html`<span class="chip">${input.live}</span>` : nothing;
    return html`<div class="panel">
      <div class="band">
        <h2 class="title">${this.#title(input)}</h2>
        ${input.variant === "art" ? chip : nothing}
      </div>
      <div class="body">
        <p class="pitch">${input.pitch}</p>
        ${input.variant === "side" ? html`${chip}${seats}` : nothing}
        <div class="buttons">
          <mc-button plain data-stop="play-online-host" .label=${input.host} ?disabled=${!input.available}></mc-button>
          <mc-button plain data-stop="play-online-join" .label=${input.join} ?disabled=${!input.available}></mc-button>
        </div>
      </div>
    </div>`;
  }
}
