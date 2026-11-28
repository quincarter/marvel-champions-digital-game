import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { glyphLabelShift, type ControlGlyph, type TabRailTab } from "@mc/ui";
import { styleMap } from "lit/directives/style-map.js";
import { StatsElement } from "../shared/StatsElement.js";
import type { StatsMode } from "../shared/stats-events.types.js";
import type { StatsTab } from "../../../view/player-stats-tabs.js";
import type { StatsChipModel } from "../mc-stats-chip-row/mc-stats-chip-row.types.js";
import { McStatsTabsStyles } from "./mc-stats-tabs.styles.js";
import type { McStatsTabsProps } from "./mc-stats-tabs.types.js";

/**
 * # Stats tabs
 * The tab row (`mc-tab-rail`) with LB / RB's glyphs over it. Where the tabs do not fit (a phone) the rail swipes sideways
 * and the chosen tab is brought into view; a phone's Filters chip takes the right end of the same row. Each tab is a focus
 * stop (`tab:<id>`).
 *
 * @element mc-stats-tabs
 * @fires mc-player-stats - `{ type: "tab", tab }`; the Filters chip's `filter` event passes through.
 */
export class McStatsTabs extends StatsElement implements McStatsTabsProps {
  static override styles = McStatsTabsStyles;

  static override properties: PropertyDeclarations = {
    tabs: { attribute: false },
    selected: { type: String },
    glyph: { attribute: false },
    toggle: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare tabs: readonly TabRailTab[];
  declare selected: string;
  declare glyph: ControlGlyph | undefined;
  declare toggle: StatsChipModel | null;
  declare mode: StatsMode;

  constructor() {
    super();
    this.tabs = [];
    this.selected = "";
    this.glyph = undefined;
    this.toggle = null;
    this.mode = "wide";
  }

  protected override updated(changed: PropertyValues): void {
    if (!changed.has("selected") && !changed.has("tabs")) return;
    // The chosen tab comes into view along the swiping row (a bare scroll of the row, never of the page).
    const scroll = this.renderRoot.querySelector<HTMLElement>(".scroll");
    const rail = this.renderRoot.querySelector("mc-tab-rail");
    const cell = rail?.shadowRoot?.querySelector<HTMLElement>("mc-button[selected]");
    if (!scroll || !cell || scroll.scrollWidth <= scroll.clientWidth) return;
    const from = scroll.getBoundingClientRect();
    const at = cell.getBoundingClientRect();
    if (at.left < from.left) scroll.scrollLeft += at.left - from.left;
    else if (at.right > from.right) scroll.scrollLeft += at.right - from.right;
  }

  override render() {
    return html`${this.glyph ? html`<div class="hint"><mc-glyph-hint .glyph=${this.glyph}></mc-glyph-hint></div>` : nothing}
      <div class="scroll">
        <mc-tab-rail
          style=${styleMap({ "--tab-count": String(this.tabs.length) })}
          .tabs=${this.tabs}
          .selected=${this.selected}
          @mc-activate=${(event: CustomEvent<{ id: string }>) => {
            event.stopPropagation();
            this.emit({ type: "tab", tab: event.detail.id as StatsTab });
          }}
        ></mc-tab-rail>
      </div>
      ${
        this.toggle
          ? html`<div
              class="toggle"
              style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(this.toggle.glyph)}px` })}
            >
              <mc-chip
                label=${this.toggle.label}
                ?selected=${this.toggle.selected}
                .stop=${this.toggle.key}
                .action=${this.toggle.action}
              ></mc-chip>
              <mc-glyph-hint .glyph=${this.toggle.glyph}></mc-glyph-hint>
            </div>`
          : nothing
      }`;
  }
}
