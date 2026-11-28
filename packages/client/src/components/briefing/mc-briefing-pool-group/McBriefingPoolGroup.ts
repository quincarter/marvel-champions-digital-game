import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import "../mc-briefing-card-thumb/mc-briefing-card-thumb.js";
import "../mc-briefing-kicker/mc-briefing-kicker.js";
import "../mc-briefing-pool-row/mc-briefing-pool-row.js";
import { poolBadgeIn, poolGroupNoteIn, poolGroupTitleIn } from "../mc-briefing-pool/pool-text.js";
import type { PoolGroupModel } from "../mc-briefing-pool/mc-briefing-pool.types.js";
import { McBriefingPoolGroupStyles } from "./mc-briefing-pool-group.styles.js";

/**
 * # Briefing pool group
 * The finale groups of "From the pool": one group per destination. On a phone each is a thin header bar over the same flat rows
 * every other issue uses; on a wide column the group is boxed, a header (its title and caption) over small picture tiles with the
 * card name and its ALLY / ENEMY / HELPS / AGAINST word under each.
 *
 * @element mc-briefing-pool-group
 * @prop group - `PoolGroupModel`.
 * @attr phone - The stacked form.
 * @fires mc-briefing - `{ type: "inspect", cardId, name }`.
 */
export class McBriefingPoolGroup extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingPoolGroupStyles];

  static override properties: PropertyDeclarations = {
    group: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare group: PoolGroupModel | null;
  declare phone: boolean;

  constructor() {
    super();
    this.group = null;
    this.phone = false;
    new BriefingRelay(this);
  }

  override render() {
    const group = this.group;
    if (!group) return nothing;
    if (this.phone) {
      return html`<div class="bar">
          <mc-briefing-kicker tone="ink" .text=${poolGroupTitleIn(group.kind)}></mc-briefing-kicker>
        </div>
        <div class="flat">
          ${group.rows.map((row) => html`<mc-briefing-pool-row .row=${row}></mc-briefing-pool-row>`)}
        </div>`;
    }
    return html`<div class="head">
        <span class="label title">${poolGroupTitleIn(group.kind).toLocaleUpperCase()}</span>
        <span class="note">${poolGroupNoteIn(group.kind)}</span>
      </div>
      <div class="tiles">
        ${group.rows.map((row) => {
          const tone = row.helps ? "heal" : "red";
          return html`<div class="tile">
            <mc-briefing-card-thumb
              shape="square"
              .stop=${`pool-card:${row.fieldId}`}
              .card=${row.card}
              .picture=${row.picture}
            ></mc-briefing-card-thumb>
            <span class="rule ${tone}"></span>
            <span class="name display">${row.name.toLocaleUpperCase()}</span>
            <span class="label ${tone}">${poolBadgeIn(row).toLocaleUpperCase()}</span>
          </div>`;
        })}
      </div>`;
  }
}
