import { McBarChart } from "./McBarChart.js";

if (!customElements.get("mc-bar-chart")) customElements.define("mc-bar-chart", McBarChart);

declare global {
  interface HTMLElementTagNameMap {
    "mc-bar-chart": McBarChart;
  }
}

export { McBarChart };
