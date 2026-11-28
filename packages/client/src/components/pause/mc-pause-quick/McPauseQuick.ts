import { html, nothing, type PropertyDeclarations } from "lit";
import "../mc-pause-link-row/mc-pause-link-row.js";
import type { PauseQuickInput } from "../pause.types.js";
import { PauseElement } from "../shared/PauseElement.js";
import { McPauseQuickStyles } from "./mc-pause-quick.styles.js";

/**
 * # Pause quick reference
 * The phone's Reference group: one toggle on a line it shares with the compact cells (Music, Report, Controls, a watch
 * link), and under it, while open, the Reference rows in as many columns as fit.
 *
 * Focus stops: `quick-toggle`, then each row's own.
 *
 * @element mc-pause-quick
 * @prop input - The toggle and the rows (`PauseQuickInput`).
 * @fires mc-pause - `{ type: "quick-toggle" }`, or a row's own event.
 */
export class McPauseQuick extends PauseElement {
  static override styles = McPauseQuickStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: PauseQuickInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const compact = input.rows.filter((row) => row.variant === "compact");
    const full = input.rows.filter((row) => row.variant !== "compact");
    return html`<div class="line">
        <mc-button
          class="toggle"
          kind="onInk"
          plain
          data-stop="quick-toggle"
          .label=${`${input.toggle.label} ${input.toggle.open ? "▾" : "▸"}`}
          ?selected=${false}
          @mc-press=${() => this.say({ type: "quick-toggle" })}
        ></mc-button>
        ${compact.map((row) => html`<mc-pause-link-row .row=${row}></mc-pause-link-row>`)}
      </div>
      ${
        full.length > 0
          ? html`<div class="rows">
              ${full.map((row) => html`<mc-pause-link-row .row=${row}></mc-pause-link-row>`)}
            </div>`
          : nothing
      }`;
  }
}
