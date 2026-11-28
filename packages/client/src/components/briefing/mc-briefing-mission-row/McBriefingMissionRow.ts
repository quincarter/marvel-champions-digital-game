import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import "../mc-briefing-framed-row/mc-briefing-framed-row.js";
import "../mc-briefing-inspect-chip/mc-briefing-inspect-chip.js";
import "../mc-briefing-kicker/mc-briefing-kicker.js";
import { McBriefingMissionRowStyles } from "./mc-briefing-mission-row.styles.js";
import type { MissionRowModel } from "./mc-briefing-mission-row.types.js";

/**
 * # Briefing mission row
 * One mission or Overseer row: a green stripe, the kind in red capitals, the card name in the display face, a short line and an
 * Inspect chip at the right that opens the card. The row grows to hold a long line instead of cutting it.
 *
 * @element mc-briefing-mission-row
 * @prop row - `MissionRowModel`.
 * @fires mc-briefing - `{ type: "inspect", cardId, name }`.
 */
export class McBriefingMissionRow extends LitElement {
  static override styles = [ThemeStyles, McBriefingMissionRowStyles];

  static override properties: PropertyDeclarations = {
    row: { attribute: false },
  };

  declare row: MissionRowModel | null;

  constructor() {
    super();
    this.row = null;
    new BriefingRelay(this);
  }

  override render() {
    const row = this.row;
    if (!row) return nothing;
    return html`<mc-briefing-framed-row stripe="heal">
      <div class="row">
        <div class="text">
          <mc-briefing-kicker .text=${row.kind}></mc-briefing-kicker>
          <span class="name display">${row.name.toLocaleUpperCase()}</span>
          ${row.detail ? html`<span class="detail">${row.detail}</span>` : nothing}
        </div>
        ${
          row.cardId !== null
            ? html`<mc-briefing-inspect-chip
                .stop=${`mission-${row.key}`}
                .label=${t("briefing.mission.inspect")}
                .card=${{ cardId: row.cardId, name: row.name }}
              ></mc-briefing-inspect-chip>`
            : nothing
        }
      </div>
    </mc-briefing-framed-row>`;
  }
}
