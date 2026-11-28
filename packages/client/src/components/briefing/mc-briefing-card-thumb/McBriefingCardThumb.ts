
import { html, nothing, svg, type PropertyDeclarations, type PropertyValues } from "lit";
import { McPress, watchCard, type PictureSource } from "@mc/ui";
import type { BriefingCard, BriefingDetail } from "../briefing.types.js";
import { McBriefingCardThumbStyles } from "./mc-briefing-card-thumb.styles.js";
import type { ThumbShape } from "./mc-briefing-card-thumb.types.js";

/**
 * # Briefing card thumb
 * A card as a picture a row or a tile shows: the scan on a parchment ground (a word in its place while it loads or when
 * there is none), an ink frame and, when asked, a magnifier badge. A tap or a hold opens the card in Inspect and answers
 * nothing, so reading a card can never record a choice; on desktop the mouse over it raises the card hover popover
 * (`watchCard`). With no `card` it is the plain frame and presses nothing. Its focus stop is the `stop` it is given, with
 * Inspect for a pad hold. Its size is its owner: set `--thumb-width` or `--thumb-height` (the other follows the shape).
 *
 * @element mc-briefing-card-thumb
 * @prop picture - The scan (`PictureSource`).
 * @prop card - The card it opens in Inspect; none for a plain frame.
 * @attr shape - `portrait` (default) | `landscape` (a scheme) | `square`.
 * @attr badge - Draw the magnifier badge on the picture.
 * @fires mc-pressed - `PressDetail` whose `action` is the inspect detail.
 * @fires mc-card-hover - From `watchCard`.
 */
export class McBriefingCardThumb extends McPress {
  static override styles = [McBriefingCardThumbStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    picture: { attribute: false },
    card: { attribute: false },
    shape: { type: String, reflect: true },
    badge: { type: Boolean },
  };

  declare picture: PictureSource | null;
  declare card: BriefingCard | null;
  declare shape: ThumbShape;
  declare badge: boolean;
  #unwatch: (() => void) | null = null;

  constructor() {
    super();
    this.picture = null;
    this.card = null;
    this.shape = "portrait";
    this.badge = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#unwatch = watchCard(this, () => (this.card ? { cardId: this.card.cardId } : null));
  }

  override disconnectedCallback(): void {
    this.#unwatch?.();
    this.#unwatch = null;
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("card")) {
      const detail: BriefingDetail | null = this.card ? { type: "inspect", ...this.card } : null;
      this.action = detail;
      this.holdAction = detail;
    }
  }

  override render() {
    return html`<mc-picture-tile .picture=${this.picture} ground="parchment" .frame=${2}></mc-picture-tile>
      ${
        this.badge
          ? html`<span class="badge" aria-hidden="true">
              ${svg`<svg viewBox="0 0 26 26" width="100%" height="100%"><circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M15 15 L20 20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`}
            </span>`
          : nothing
      }`;
  }
}
