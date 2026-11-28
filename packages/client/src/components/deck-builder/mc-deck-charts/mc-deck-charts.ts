import { McDeckCharts } from "./McDeckCharts.js";

if (!customElements.get("mc-deck-charts")) {
  customElements.define("mc-deck-charts", McDeckCharts);
}

export { McDeckCharts };
