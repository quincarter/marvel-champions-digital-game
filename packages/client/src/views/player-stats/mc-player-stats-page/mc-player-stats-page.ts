/**
 * Your stats, the page: only composes. The header (Back, the title, the You / Everyone switch), the tab row, the controls
 * under it (filters, Matchups chips, steppers, Share), then the body: a tab's list (with the Focus view's side list beside
 * it), the Matchups heat or stamp grid, or a word while the saves are read. Each part is its own element in
 * `components/player-stats/`; this file registers them once (shared `@mc/ui` elements are defined by the ui entry) and
 * holds nothing of its own.
 *
 * In: `model` (`StatsPageModel`) and `mode`. Out: `mc-player-stats` (`StatsEventDetail`) from the parts, `mc-image-error`
 * and the card hover and Inspect events from the card pictures, and `mc-player-stats-rendered` when a part drew.
 */
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import type { StatsMode } from "../../../components/player-stats/shared/stats-events.types.js";
import "../../../components/player-stats/mc-stats-credited/mc-stats-credited.js";
import "../../../components/player-stats/mc-stats-matchup-legend/mc-stats-matchup-legend.js";
import "../../../components/player-stats/mc-stats-source-switch/mc-stats-source-switch.js";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import { statsEvent } from "../../../components/player-stats/shared/stats-events.types.js";
import "../../../components/player-stats/mc-stats-tabs/mc-stats-tabs.js";
import "../../../components/player-stats/mc-stats-controls/mc-stats-controls.js";
import "../../../components/player-stats/mc-stats-list/mc-stats-list.js";
import "../../../components/player-stats/mc-stats-matchup-side/mc-stats-matchup-side.js";
import "../../../components/player-stats/mc-stats-matchup-grid/mc-stats-matchup-grid.js";
import { McPlayerStatsPageStyles } from "./mc-player-stats-page.styles.js";
import { StatsResponsiveStyles } from "./responsive.styles.js";
import type { McPlayerStatsPageProps, StatsBody, StatsPageModel } from "./mc-player-stats-page.types.js";
import type { McStatsList } from "../../../components/player-stats/mc-stats-list/McStatsList.js";
import type { McStatsMatchupGrid } from "../../../components/player-stats/mc-stats-matchup-grid/McStatsMatchupGrid.js";

export class McPlayerStatsPage extends LitElement implements McPlayerStatsPageProps {
  static override styles = [ThemeStyles, McPlayerStatsPageStyles, StatsResponsiveStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare model: StatsPageModel | null;
  declare mode: StatsMode;

  constructor() {
    super();
    this.model = null;
    this.mode = "wide";
  }

  /** The tab's list, when the body is one: the pad's stick and paging move its scroller. */
  get list(): McStatsList | null {
    return this.renderRoot.querySelector<McStatsList>("mc-stats-list");
  }

  /** The Matchups grid, when the body is one. */
  get grid(): McStatsMatchupGrid | null {
    return this.renderRoot.querySelector<McStatsMatchupGrid>("mc-stats-matchup-grid");
  }

  #body(body: StatsBody) {
    switch (body.kind) {
      case "message":
        return html`<mc-empty-state message=${body.text} dim></mc-empty-state>`;
      case "grid":
        return html`<mc-stats-matchup-grid
          .grid=${body.grid}
          .cursor=${body.cursor}
          .mode=${this.mode}
        ></mc-stats-matchup-grid>`;
      case "list":
        return html`<div class="content">
          ${body.side ? html`<mc-stats-matchup-side .rows=${body.side}></mc-stats-matchup-side>` : nothing}
          <mc-stats-list .blocks=${body.blocks} scroll-key=${body.scrollKey}></mc-stats-list>
        </div>`;
    }
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    const head = model.header;
    return html`<mc-top-bar
        ?compact=${this.mode === "phone"}
        .heading=${head.title}
        .backLabel=${head.backLabel}
        .backGlyph=${hintGlyphOf(head.backGlyph)}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.dispatchEvent(statsEvent({ type: "back" }));
        }}
      >
        ${head.played ? html`<span slot="end" class="played">${head.played}</span>` : nothing}
        ${
          head.showSource
            ? html`<mc-stats-source-switch
                slot="end"
                .source=${head.source}
                .youLabel=${head.youLabel}
                .everyoneLabel=${head.everyoneLabel}
                .glyph=${head.sourceGlyph}
                ?compact=${this.mode === "phone"}
              ></mc-stats-source-switch>`
            : nothing
        }
      </mc-top-bar>
      <div class="body">
        ${
          model.tabs
            ? html`<mc-stats-tabs
                .tabs=${model.tabs.tabs}
                .selected=${model.tabs.selected}
                .glyph=${model.tabs.glyph}
                .toggle=${model.tabs.toggle}
                .mode=${this.mode}
              ></mc-stats-tabs>`
            : nothing
        }
        <mc-stats-controls .rows=${model.controls} .mode=${this.mode}></mc-stats-controls>
        ${this.#body(model.body)}
      </div>`;
  }
}

if (!customElements.get("mc-player-stats-page")) {
  customElements.define("mc-player-stats-page", McPlayerStatsPage);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-player-stats-page": McPlayerStatsPage;
  }
}
