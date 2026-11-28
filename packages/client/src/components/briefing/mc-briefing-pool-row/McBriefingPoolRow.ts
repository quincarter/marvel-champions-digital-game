import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import { sectionTextIn } from "../shared/section-text.js";
import "../mc-briefing-card-thumb/mc-briefing-card-thumb.js";
import "../mc-briefing-framed-row/mc-briefing-framed-row.js";
import type { PoolRowModel } from "../mc-briefing-pool/mc-briefing-pool.types.js";
import { McBriefingPoolRowStyles } from "./mc-briefing-pool-row.styles.js";

/**
 * # Briefing pool row
 * One flat row of "From the pool": a stripe (green when the card helps, red when it is against the team), the card picture, its
 * name, where this issue setup puts it, and a mark at the right. The mark is a check or a cross as well as a colour, so helps and
 * against never read by colour alone. A tap or hold on the picture reads the card in Inspect.
 *
 * @element mc-briefing-pool-row
 * @prop row - `PoolRowModel`.
 * @fires mc-briefing - `{ type: "inspect", cardId, name }`.
 */
export class McBriefingPoolRow extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingPoolRowStyles];

  static override properties: PropertyDeclarations = {
    row: { attribute: false },
  };

  declare row: PoolRowModel | null;

  constructor() {
    super();
    this.row = null;
    new BriefingRelay(this);
  }

  override render() {
    const row = this.row;
    if (!row) return nothing;
    return html`<mc-briefing-framed-row stripe=${row.helps ? "heal" : "red"}>
      <div class="row">
        <mc-briefing-card-thumb
          shape="square"
          .stop=${`pool-card:${row.fieldId}`}
          .card=${row.card}
          .picture=${row.picture}
        ></mc-briefing-card-thumb>
        <div class="text">
          <span class="name display">${row.name.toLocaleUpperCase()}</span>
          <span class="where">${sectionTextIn().poolDestination(row.destination)}</span>
        </div>
        <span class=${row.helps ? "mark heal" : "mark red"}>${row.helps ? "✓" : "✗"}</span>
      </div>
    </mc-briefing-framed-row>`;
  }
}
