import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McPastGameSeatStyles } from "./mc-past-game-seat.styles.js";
import type { McPastGameSeatProps, PastGameSeatModel } from "./mc-past-game-seat.types.js";

/**
 * # Past game seat
 * One seat in a game's details: the hero (and whether it fell), its damage and thwart, the deck it played and the cards
 * it played most (#756). Every seat at the table gets one, not only the first.
 *
 * @element mc-past-game-seat
 * @prop model - The seat (`PastGameSeatModel`).
 */
export class McPastGameSeat extends LitElement implements McPastGameSeatProps {
  static override styles = [McPastGameSeatStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: PastGameSeatModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="heading">${m.heading}</div>
      ${m.lines.map((line) => html`<div class="line">${line}</div>`)}`;
  }
}
