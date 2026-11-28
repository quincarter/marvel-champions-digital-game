import { html, nothing, type PropertyDeclarations } from "lit";
import { SeatsElement } from "../SeatsElement.js";
import type { SeatsFooterModel } from "../seats.types.js";
import { McSeatsFooterStyles } from "./mc-seats-footer.styles.js";

/**
 * # Seats footer
 * The two ways on: a quiet Deck check for the active seat's deck and the red Play N heroes. Wide, they are stacked at the
 * foot of the ink detail panel; narrow, one row in the sticky ink bar at the screen's foot. With no hero Deck check is
 * disabled and neither is a stop. Play carries `playBlocked` as its tooltip while it is off (no hero, a locked hero) and
 * still raises its press, for the scene to say why: it is not a dead control.
 *
 * @element mc-seats-footer
 * @prop model - The two buttons (`SeatsFooterModel`).
 * @attr wide - Stacked, for the ink panel (default: one row).
 * @fires mc-seats - `{ type: "action", action: "play" | "deck-check" }`.
 */
export class McSeatsFooter extends SeatsElement {
  static override styles = [McSeatsFooterStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    wide: { type: Boolean, reflect: true },
  };

  declare model: SeatsFooterModel | null;
  declare wide: boolean;

  constructor() {
    super();
    this.model = null;
    this.wide = false;
  }

  protected override act(action: string): void {
    if (action === "play") this.emit({ type: "action", action: "play" });
    else if (action === "deck-check" && this.model?.deckCheckBlocked === null)
      this.emit({ type: "action", action: "deck-check" });
  }

  override render() {
    const foot = this.model;
    if (!foot) return nothing;
    const noHeroes = foot.deckCheckBlocked !== null;
    const glyph = foot.playGlyph;
    return html`<div class="foot">
      <button
        type="button"
        class="deck-check"
        data-action="deck-check"
        data-stop=${noHeroes ? "" : "deck-check"}
        ?disabled=${noHeroes}
        title=${foot.deckCheckBlocked ?? ""}
      >
        ${foot.deckCheckLabel}
      </button>
      <button
        type="button"
        class="play"
        data-action="play"
        data-stop=${noHeroes ? "" : "play"}
        aria-disabled=${foot.playBlocked !== null ? "true" : "false"}
        title=${foot.playBlocked ?? ""}
      >
        ${
          glyph
            ? html`<mc-glyph
                class="glyph"
                .specs=${glyph.specs}
                .height=${glyph.height}
                .ground=${glyph.ground}
                .openness=${glyph.openness}
                ?still=${glyph.still ?? false}
              ></mc-glyph>`
            : nothing
        }
        <span class="word">${foot.playLabel}</span>
      </button>
    </div>`;
  }
}
