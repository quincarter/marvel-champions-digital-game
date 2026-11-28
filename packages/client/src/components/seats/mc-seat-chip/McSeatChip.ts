import { html, nothing, type PropertyDeclarations } from "lit";
import { SeatsElement } from "../SeatsElement.js";
import type { SeatModel } from "../seats.types.js";
import { McSeatChipStyles } from "./mc-seat-chip.styles.js";

/**
 * # Seat chip
 * One of the four seats on a narrow layout (P03's "SEAT 1 / C. MARVEL"): the red label, a Bangers name (or the empty
 * word) and, where there is room, a short meta line. The frame says the seat's state without the colour, as the seat
 * card's does. There is no clear ✕ at this width: clearing is the seat summary's Clear seat. A reachable seat is one
 * stop, `seat:<index>`.
 *
 * @element mc-seat-chip
 * @prop model - The seat (`SeatModel`); the chip reads `model.chip` where there is one, else the card's words.
 * @fires mc-seats - `{ type: "seat", index }`.
 */
export class McSeatChip extends SeatsElement {
  static override styles = [McSeatChipStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: SeatModel | null;

  constructor() {
    super();
    this.model = null;
  }

  protected override act(action: string): void {
    const seat = this.model;
    if (seat && action === "seat") this.emit({ type: "seat", index: seat.index });
  }

  override render() {
    const seat = this.model;
    if (!seat) return nothing;
    const filled = seat.frame === "filled" || seat.frame === "activeFilled";
    const label = seat.chip?.label ?? seat.label;
    const meta = seat.chip ? seat.chip.meta : seat.meta;
    const empty = seat.chip ? seat.chip.empty : seat.empty;
    return html`<div class="face" data-frame=${seat.frame}>
      <span class="label">${label}</span>
      ${
        filled
          ? html`<span class="name">${seat.name ?? "?"}</span
              >${meta ? html`<span class="meta">${meta}</span>` : nothing}`
          : empty
            ? html`<span class="empty">${empty}</span>`
            : nothing
      }
      ${
        seat.frame === "locked"
          ? nothing
          : html`<button
              type="button"
              class="press"
              data-action="seat"
              data-stop=${`seat:${seat.index}`}
              aria-label=${[label, seat.name ?? empty ?? ""].filter((part) => part !== "").join(", ")}
            ></button>`
      }
    </div>`;
  }
}
