import { ThemeStyles } from "@mc/ui";
import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { PastGamesElement } from "../shared/PastGamesElement.js";
import { McPastGameDetailsStyles } from "./mc-past-game-details.styles.js";
import type { McPastGameDetailsProps, PastGameDetailsModel } from "./mc-past-game-details.types.js";
import "../mc-past-game-actions/mc-past-game-actions.js";
import "../mc-past-game-pictures/mc-past-game-pictures.js";
import "../mc-past-game-seat/mc-past-game-seat.js";
import "../mc-past-game-summary/mc-past-game-summary.js";

/**
 * # Past game details
 * A game's details: larger pictures, the words (result, why, title, when, the campaign, then every seat's hero, stats,
 * deck and most played cards) in a region of their own that scrolls, and the four actions. Beside the list (desktop and
 * tablet) it is a panel; as a phone's popup (`popup`) it stands over the screen on a scrim that takes every press, with a
 * close button (stop `close`). The words' scroll is kept while the same game shows and starts over for another.
 *
 * Needs `@mc/ui` defined (`mc-button`, `mc-picture-tile`).
 *
 * @element mc-past-game-details
 * @prop model - The game (`PastGameDetailsModel`); null draws nothing.
 * @attr popup - A phone's popup.
 * @fires mc-past-games - `{ type: "close" }` from the close button; the actions' `{ type: "action" }` pass through.
 */
export class McPastGameDetails extends PastGamesElement implements McPastGameDetailsProps {
  static override styles = [ThemeStyles, McPastGameDetailsStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    popup: { type: Boolean, reflect: true },
  };

  declare model: PastGameDetailsModel | null;
  declare popup: boolean;

  constructor() {
    super();
    this.model = null;
    this.popup = false;
  }

  /** The words' own scroller: the stick and the Page keys move it while the details have the ring. */
  get scroller(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".words");
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    const was = changed.get("model") as PastGameDetailsModel | null | undefined;
    // Another game's words start from their top.
    if (changed.has("model") && was && this.model && was.id !== this.model.id) {
      const scroller = this.scroller;
      if (scroller) scroller.scrollTop = 0;
    }
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<section
      class="panel"
      role=${this.popup ? "dialog" : "region"}
      aria-modal=${this.popup ? "true" : "false"}
    >
      ${
        this.popup
          ? html`<mc-button
              class="close"
              kind="secondary"
              data-stop="close"
              data-key="close"
              label="✕"
              aria-label=${m.closeLabel}
              @mc-press=${(event: Event) => {
                event.stopPropagation();
                this.emit({ type: "close" });
              }}
            ></mc-button>`
          : nothing
      }
      <mc-past-game-pictures size="detail" .pictures=${m.pictures}></mc-past-game-pictures>
      <div class="words scroller" tabindex="-1" data-key="details">
        <mc-past-game-summary size="detail" .model=${m.summary}></mc-past-game-summary>
        ${m.seats.map((seat) => html`<mc-past-game-seat .model=${seat}></mc-past-game-seat>`)}
      </div>
      <mc-past-game-actions .gameId=${m.id} .actions=${m.actions} ?busy=${m.busy}></mc-past-game-actions>
    </section>`;
  }
}
