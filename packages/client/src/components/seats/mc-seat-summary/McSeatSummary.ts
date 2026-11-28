import { html, nothing, type PropertyDeclarations } from "lit";
import { SeatsElement } from "../SeatsElement.js";
import type { SeatSummaryModel } from "../seats.types.js";
import { McSeatSummaryStyles } from "./mc-seat-summary.styles.js";

/**
 * # Seat summary
 * The narrow layouts' strip for the active seat: its facts on short lines (stats, hand, obligation, nemesis) beside a
 * Clear seat button, the chips having no room for a ✕; an empty active seat shows its hint instead. With `toggle` the
 * strip is a disclosure: one quiet button (`seat-details-toggle`) that opens and shuts the block under it. Clear seat is
 * stop `clear-seat`, and only a seat with a hero has one. While the last hero stays, Clear carries `clearBlocked` as its
 * tooltip and `aria-disabled`; the press is still raised, for the scene to explain.
 *
 * @element mc-seat-summary
 * @prop model - The strip (`SeatSummaryModel`).
 * @fires mc-seats - `{ type: "clear-seat" }` or `{ type: "toggle", what: "details" }`.
 */
export class McSeatSummary extends SeatsElement {
  static override styles = [McSeatSummaryStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: SeatSummaryModel | null;

  constructor() {
    super();
    this.model = null;
  }

  protected override act(action: string): void {
    if (action === "clear") this.emit({ type: "clear-seat" });
    else if (action === "details") this.emit({ type: "toggle", what: "details" });
  }

  override render() {
    const summary = this.model;
    if (!summary) return nothing;
    const toggle = summary.toggle ?? null;
    const open = toggle === null || toggle.open;
    return html`
      ${
        toggle
          ? html`<button
              type="button"
              class="toggle"
              data-action="details"
              data-stop="seat-details-toggle"
              aria-expanded=${toggle.open ? "true" : "false"}
            >
              ${toggle.label}
            </button>`
          : nothing
      }
      ${
        open
          ? summary.hint !== null
            ? html`<p class="hint">${summary.hint}</p>`
            : html`<div class="block">
                <ul class="lines">
                  ${summary.lines.map((line) => html`<li class=${line.strong ? "strong" : "soft"}>${line.text}</li>`)}
                </ul>
                <button
                  type="button"
                  class="clear"
                  data-action="clear"
                  data-stop="clear-seat"
                  aria-disabled=${summary.clearBlocked !== null ? "true" : "false"}
                  title=${summary.clearBlocked ?? ""}
                >
                  ${summary.clearLabel}
                </button>
              </div>`
          : nothing
      }
    `;
  }
}
