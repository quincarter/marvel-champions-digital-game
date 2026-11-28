import { McDonutChart } from "./McDonutChart.js";

if (!customElements.get("mc-donut-chart")) {
  customElements.define("mc-donut-chart", McDonutChart);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-donut-chart": McDonutChart;
  }
}

export { McDonutChart };
