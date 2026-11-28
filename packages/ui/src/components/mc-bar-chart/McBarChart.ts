import { html, LitElement, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import "../mc-chart-bar/mc-chart-bar.js";
import { McBarChartStyles } from "./mc-bar-chart.styles.js";
import type { BarChartBar } from "./mc-bar-chart.types.js";

/**
 * # Bar chart
 * A row of bars (`mc-chart-bar`) with a label under each, as tall as their count against the largest (never under 2px);
 * the bars marked `highlight` are red, the rest ink with an outline. `height` (px, default 84) is the whole chart,
 * labels included.
 *
 * @element mc-bar-chart
 */
export class McBarChart extends LitElement {
  static override styles = [ThemeStyles, McBarChartStyles];

  static override properties: PropertyDeclarations = { bars: { attribute: false }, height: { type: Number } };

  declare bars: readonly BarChartBar[];
  declare height: number;

  constructor() {
    super();
    this.bars = [];
    this.height = 84;
  }

  override willUpdate(): void {
    this.style.setProperty("--chart-height", `${this.height}px`);
  }

  override render() {
    const max = Math.max(1, ...this.bars.map((bar) => bar.count));
    return html`${this.bars.map(
      (bar) =>
        html`<mc-chart-bar
          .label=${bar.label}
          .count=${bar.count}
          .max=${max}
          .highlight=${bar.highlight}
          .tint=${bar.tint ?? ""}
        ></mc-chart-bar>`,
    )}`;
  }
}
