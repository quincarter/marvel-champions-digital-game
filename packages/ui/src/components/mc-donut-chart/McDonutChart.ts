import { html, LitElement, svg, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "../../shared/theme.styles.js";
import { McDonutChartStyles } from "./mc-donut-chart.styles.js";
import type { DonutSlice, McDonutChartProps } from "./mc-donut-chart.types.js";

/**
 * # Donut chart
 * A ring of arcs, each as long as its share of the whole in its own colour, edged in ink inside and out, with words in the
 * hole. A drawing, not a control: whatever it stands for is also written beside it (a legend), so no share is colour only.
 *
 * @element mc-donut-chart
 */
export class McDonutChart extends LitElement implements McDonutChartProps {
  static override styles = [ThemeStyles, McDonutChartStyles];

  static override properties: PropertyDeclarations = {
    slices: { attribute: false },
    size: { type: Number },
    thickness: { type: Number },
    center: { type: String },
    chartKey: { type: String, attribute: "chart-key" },
  };

  declare slices: readonly DonutSlice[];
  declare size: number;
  declare thickness: number;
  declare center: string;
  declare chartKey: string;

  constructor() {
    super();
    this.slices = [];
    this.size = 156;
    this.thickness = 32;
    this.center = "";
    this.chartKey = "";
  }

  override willUpdate(): void {
    this.style.setProperty("--donut-size", `${this.size}px`);
  }

  #arcs(mid: number, c: number) {
    const total = this.slices.reduce((n, s) => n + s.value, 0) || 1;
    const at = (angle: number): string =>
      `${(c + mid * Math.cos(angle)).toFixed(2)} ${(c + mid * Math.sin(angle)).toFixed(2)}`;
    let start = -Math.PI / 2;
    return this.slices.map((slice) => {
      const sweep = (slice.value / total) * Math.PI * 2;
      const from = start;
      start += sweep;
      if (sweep >= Math.PI * 2 - 1e-6)
        return svg`<circle class="ring" cx=${c} cy=${c} r=${mid} stroke=${slice.color} stroke-width=${this.thickness}></circle>`;
      if (sweep <= 0) return svg``;
      const large = sweep > Math.PI ? 1 : 0;
      return svg`<path
        class="ring"
        d=${`M ${at(from)} A ${mid} ${mid} 0 ${large} 1 ${at(from + sweep)}`}
        stroke=${slice.color}
        stroke-width=${this.thickness}
      ></path>`;
    });
  }

  override render() {
    const c = this.size / 2;
    const radius = c - 1;
    const mid = radius - this.thickness / 2;
    return html`<svg
        viewBox=${`0 0 ${this.size} ${this.size}`}
        role="img"
        aria-label=${this.center}
        data-key=${this.chartKey}
      >
        ${this.#arcs(mid, c)}
        <circle class="edge" cx=${c} cy=${c} r=${radius}></circle>
        <circle class="edge" cx=${c} cy=${c} r=${radius - this.thickness}></circle>
      </svg>
      <div class="center">${this.center}</div>`;
  }
}
