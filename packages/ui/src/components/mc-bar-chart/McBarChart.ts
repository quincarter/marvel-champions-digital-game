import { css, html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import type { BarChartBar } from "./mc-bar-chart.types.js";

const styles = css`
  :host {
    display: flex;
    gap: 6px;
  }
  .column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .bar {
    background: var(--mc-fill-ink);
    box-shadow: 0 0 0 1px var(--mc-line-ink);
  }
  .bar.highlight {
    background: var(--mc-fill-red);
    box-shadow: none;
  }
  .axis {
    height: 18px;
    padding-top: 8px;
    text-align: center;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 10px;
    opacity: 0.6;
  }
`;

/**
 * # Bar chart
 * A row of bars with a label under each, as tall as their count against the largest (never under 2px); the bars marked
 * `highlight` are red, the rest ink with an outline. `height` (px, default 84) is the whole chart, labels included.
 *
 * @element mc-bar-chart
 */
export class McBarChart extends LitElement {
  static override styles = [ThemeStyles, styles];

  static override properties: PropertyDeclarations = { bars: { attribute: false }, height: { type: Number } };

  declare bars: readonly BarChartBar[];
  declare height: number;

  constructor() {
    super();
    this.bars = [];
    this.height = 84;
  }

  override updated(): void {
    this.style.height = `${this.height}px`;
  }

  override render() {
    const max = Math.max(1, ...this.bars.map((bar) => bar.count));
    return html`${this.bars.map(
      (bar) =>
        html`<div class="column">
          <div
            class=${bar.highlight ? "bar highlight" : "bar"}
            style=${`height:${Math.max(2, Math.round((bar.count / max) * (this.height - 18)))}px${bar.tint ? `;background:${bar.tint}` : ""}`}
          ></div>
          <div class="axis">${bar.label}</div>
        </div>`,
    )}`;
  }
}
