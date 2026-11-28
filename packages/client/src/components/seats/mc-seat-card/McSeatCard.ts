import { html, nothing, type PropertyDeclarations } from "lit";
import { SeatsElement } from "../SeatsElement.js";
import type { SeatModel } from "../seats.types.js";
import { McSeatCardStyles } from "./mc-seat-card.styles.js";

/**
 * # Seat card
 * One of the four seats on the wide layout: a portrait thumbnail, the red seat label, the Bangers hero name, a meta line and,
 * on a filled seat, its ✕. The frame (solid, dashed or thin) says the seat's state without the colour. A reachable seat
 * is one stop, `seat:<index>`; the ✕ is `seat-clear:<deck id>`.
 *
 * @element mc-seat-card
 * @prop model - The seat (`SeatModel`).
 * @fires mc-seats - `{ type: "seat", index }` or `{ type: "clear", index, deckId }`.
 */
export class McSeatCard extends SeatsElement {
  static override styles = [McSeatCardStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: SeatModel | null;

  constructor() {
    super();
    this.model = null;
  }

  protected override act(action: string): void {
    const seat = this.model;
    if (!seat) return;
    if (action === "seat") this.emit({ type: "seat", index: seat.index });
    else if (action === "clear") this.emit({ type: "clear", index: seat.index, deckId: seat.deckId });
  }

  override render() {
    const seat = this.model;
    if (!seat) return nothing;
    const filled = seat.frame === "filled" || seat.frame === "activeFilled";
    return html`<div class="face" data-frame=${seat.frame}>
      ${
        filled && seat.picture
          ? html`<mc-picture-tile class="thumb" .picture=${seat.picture} .frame=${1}></mc-picture-tile>`
          : nothing
      }
      <div class="words">
        <span class="label">${seat.label}</span>
        ${
          filled
            ? html`<span class="name">${seat.name ?? "?"}</span>
                ${seat.meta ? html`<span class="meta">${seat.meta}</span>` : nothing}`
            : seat.empty
              ? html`<span class="empty">${seat.empty}</span>`
              : nothing
        }
      </div>
      ${
        seat.frame === "locked"
          ? nothing
          : html`<button
              type="button"
              class="press"
              data-action="seat"
              data-stop=${`seat:${seat.index}`}
              aria-label=${[seat.label, seat.name ?? seat.empty ?? ""].filter((part) => part !== "").join(", ")}
            ></button>`
      }
      ${
        filled && seat.clearLabel !== null
          ? html`<button
              type="button"
              class="clear"
              data-action="clear"
              data-stop=${`seat-clear:${seat.deckId ?? seat.index}`}
              aria-label=${seat.clearLabel}
            >
              ✕
            </button>`
          : nothing
      }
    </div>`;
  }
}
