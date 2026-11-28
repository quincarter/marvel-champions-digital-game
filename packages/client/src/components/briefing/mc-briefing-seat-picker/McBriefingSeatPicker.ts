import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import { raiseBriefing } from "../briefing.types.js";
import { McBriefingSeatPickerStyles } from "./mc-briefing-seat-picker.styles.js";
import type { SeatPickerModel } from "./mc-briefing-seat-picker.types.js";

/**
 * # Briefing seat picker
 * "Edit which deck?": one button per seat, over a scrim that takes every press so nothing behind it moves. Opened by EDIT DECKS
 * when several seats could be meant and none is the problem. A tap on the scrim, or Cancel, closes it. Its buttons are the whole
 * focus route while it is up (the scene replaces the stops with them).
 *
 * @element mc-briefing-seat-picker
 * @prop model - `SeatPickerModel`.
 * @fires mc-briefing - `{ type: "edit-decks", seat }` or `{ type: "close-seat-picker" }`.
 */
export class McBriefingSeatPicker extends LitElement {
  static override styles = [ThemeStyles, McBriefingSeatPickerStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: SeatPickerModel | null;

  constructor() {
    super();
    this.model = null;
    new BriefingRelay(this);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-hit-area class="scrim" .action=${{ type: "close-seat-picker" }}></mc-hit-area>
      <div class="panel">
        <h2 class="title">${m.title.toLocaleUpperCase()}</h2>
        ${m.seats.map(
          (seat) => html`<mc-button
            kind="primary"
            data-stop=${`pick-seat-${seat.seat}`}
            .label=${seat.label}
            @mc-press=${(event: Event) => {
              event.stopPropagation();
              raiseBriefing(this, { type: "edit-decks", seat: seat.seat });
            }}
          ></mc-button>`,
        )}
        <mc-button
          kind="secondary"
          data-stop="pick-cancel"
          .label=${m.cancel}
          @mc-press=${(event: Event) => {
            event.stopPropagation();
            raiseBriefing(this, { type: "close-seat-picker" });
          }}
        ></mc-button>
      </div>`;
  }
}
