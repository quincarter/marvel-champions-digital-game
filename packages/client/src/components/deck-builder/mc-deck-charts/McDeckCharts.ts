import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import "../mc-odds-panel/mc-odds-panel.js";
import { McDeckChartsStyles } from "./mc-deck-charts.styles.js";
import type { DeckChartsMode, DeckChartsModel } from "./mc-deck-charts.types.js";

/**
 * # Deck charts
 * The cost curve (a bar per cost, the last "N+", `view/deck-stats.ts`'s own counts) and the draw odds. On the wide left rail
 * they share its last room behind two tabs (`chart:curve`, `chart:odds`); stacked in the narrow Deck tab both are shown under
 * their own labels.
 *
 * Focus stops: `chart:curve`, `chart:odds` (tabs mode), and the odds' own (`mc-odds-panel`).
 *
 * @element mc-deck-charts
 * @prop model - The charts (`DeckChartsModel`).
 * @attr mode - tabs | stacked.
 * @attr tab - curve | odds: the chart the tabs show.
 * @fires mc-deck-builder - `chart-tab`, and the odds' `odds`.
 */
export class McDeckCharts extends BuilderElement {
  static override styles = [ThemeStyles, McDeckChartsStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    mode: { type: String, reflect: true },
    tab: { type: String },
  };

  declare model: DeckChartsModel | null;
  declare mode: DeckChartsMode;
  declare tab: "curve" | "odds";

  constructor() {
    super();
    this.model = null;
    this.mode = "tabs";
    this.tab = "curve";
  }

  #curve(model: DeckChartsModel) {
    return html`<mc-bar-chart .bars=${model.bars} .height=${this.mode === "tabs" ? 74 : 90}></mc-bar-chart>`;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    if (this.mode === "stacked") {
      return html`<div class="block">
          <div class="label">${model.curveLabel}</div>
          ${this.#curve(model)}
        </div>
        <div class="block">
          <div class="label">${model.oddsLabel}</div>
          <mc-odds-panel .model=${model.odds}></mc-odds-panel>
        </div>`;
    }
    return html`<div class="tabs">
        ${(["curve", "odds"] as const).map(
          (tab) =>
            html`<mc-button
              kind="secondary"
              data-stop=${`chart:${tab}`}
              .label=${tab === "curve" ? model.curveTab : model.oddsTab}
              ?selected=${this.tab === tab}
              @mc-press=${this.send({ type: "chart-tab", tab })}
            ></mc-button>`,
        )}
      </div>
      ${this.tab === "curve" ? this.#curve(model) : html`<mc-odds-panel .model=${model.odds}></mc-odds-panel>`}`;
  }
}
