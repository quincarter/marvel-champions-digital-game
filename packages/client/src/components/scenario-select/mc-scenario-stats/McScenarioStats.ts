import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import "../mc-scenario-stat-cell/mc-scenario-stat-cell.js";
import { McScenarioStatsStyles } from "./mc-scenario-stats.styles.js";
import type { ScenarioStatCell } from "./mc-scenario-stats.types.js";

/**
 * # Scenario stats
 * The bordered parchment band of the picked scenario's numbers: main scheme, starting threat, villain HP and encounter
 * sets, four across (`wide`) or two by two. Reads the same detail the stages panel does, so the two can't disagree.
 *
 * @element mc-scenario-stats
 * @prop cells - `ScenarioStatCell[]`; nothing is drawn when empty.
 * @attr wide - Four cells across instead of two by two.
 */
export class McScenarioStats extends LitElement {
  static override styles = [ThemeStyles, McScenarioStatsStyles];

  static override properties: PropertyDeclarations = {
    cells: { attribute: false },
    wide: { type: Boolean, reflect: true },
  };

  declare cells: readonly ScenarioStatCell[];
  declare wide: boolean;

  constructor() {
    super();
    this.cells = [];
    this.wide = false;
  }

  override render() {
    if (this.cells.length === 0) return nothing;
    return html`${repeat(
      this.cells,
      (cell) => cell.label,
      (cell) => html`<mc-scenario-stat-cell .label=${cell.label} .value=${cell.value}></mc-scenario-stat-cell>`,
    )}`;
  }
}
