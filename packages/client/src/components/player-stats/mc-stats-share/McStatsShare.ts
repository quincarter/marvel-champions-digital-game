import { html, nothing, type PropertyDeclarations } from "lit";
import { StatsElement } from "../shared/StatsElement.js";
import { McStatsShareStyles } from "./mc-stats-share.styles.js";
import type { McStatsShareProps, StatsShareInput } from "./mc-stats-share.types.js";

/**
 * # Share my games
 * Under Everyone's tabs: the "Share my games" chip and the one fixed line saying what is sent (never where the tabs were
 * a moment ago, so a tap on a tab from habit cannot turn sharing on), or "Sharing on" once it is.
 *
 * @element mc-stats-share
 * @prop input - Offer or on (`StatsShareInput`).
 * @fires mc-player-stats - `{ type: "share" }`.
 */
export class McStatsShare extends StatsElement implements McStatsShareProps {
  static override styles = McStatsShareStyles;

  static override properties: PropertyDeclarations = { input: { attribute: false } };

  declare input: StatsShareInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    if (input.kind === "on") return html`<div class="on">${input.label}</div>`;
    return html`<mc-stats-chip-row .chips=${[input.chip]}></mc-stats-chip-row>
      <div class="line">${input.line}</div>`;
  }
}
