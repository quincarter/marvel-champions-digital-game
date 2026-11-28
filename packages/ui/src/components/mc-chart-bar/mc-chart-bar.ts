import { McChartBar } from "./McChartBar.js";

if (!customElements.get("mc-chart-bar")) {
  customElements.define("mc-chart-bar", McChartBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-chart-bar": McChartBar;
  }
}

export { McChartBar };
