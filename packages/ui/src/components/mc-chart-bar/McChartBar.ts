import { html, LitElement, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McChartBarStyles } from "./mc-chart-bar.styles.js";
import type { McChartBarProps } from "./mc-chart-bar.types.js";

/**
 * # Chart bar
 * One column of a bar chart: a bar as tall as its share of the largest count (never under 2px) over its label. The
 * chart's own height comes from the CSS custom property `--chart-height` its parent sets.
 *
 * @element mc-chart-bar
 */
export class McChartBar extends LitElement implements McChartBarProps {
  static override styles = [ThemeStyles, McChartBarStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    count: { type: Number },
    max: { type: Number },
    highlight: { type: Boolean, reflect: true },
    tint: { type: String },
  };

  declare label: string;
  declare count: number;
  declare max: number;
  declare highlight: boolean;
  declare tint: string;

  constructor() {
    super();
    this.label = "";
    this.count = 0;
    this.max = 1;
    this.highlight = false;
    this.tint = "";
  }

  override render() {
    const ratio = this.count / Math.max(1, this.max);
    const bar = styleMap({ "--ratio": String(ratio), ...(this.tint ? { "--tint": this.tint } : {}) });
    return html`<div class="bar" style=${bar}></div>
      <div class="axis">${this.label}</div>`;
  }
}
