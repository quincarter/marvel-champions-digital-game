import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type BarChartBar } from "@mc/ui";
import { McCostCurveStyles } from "./mc-cost-curve.styles.js";
import type { McCostCurveProps } from "./mc-cost-curve.types.js";

/** The chart's whole height, labels included: in the rail, and on the narrow tab's card. */
const RAIL_CHART_HEIGHT = 74;
const FRAMED_CHART_HEIGHT = 96;

/**
 * # Cost curve
 * How many cards of each cost the deck holds, as a bar chart (`mc-bar-chart`) under a title and the average cost.
 *
 * @element mc-cost-curve
 */
export class McCostCurve extends LitElement implements McCostCurveProps {
  static override styles = [ThemeStyles, McCostCurveStyles];

  static override properties: PropertyDeclarations = {
    heading: { type: String },
    average: { type: String },
    bars: { attribute: false },
    framed: { type: Boolean, reflect: true },
  };

  declare heading: string;
  declare average: string;
  declare bars: readonly BarChartBar[];
  declare framed: boolean;

  constructor() {
    super();
    this.heading = "";
    this.average = "";
    this.bars = [];
    this.framed = false;
  }

  override render() {
    return html`<div class="head">
        <span class="heading">${this.heading}</span>
        ${this.average ? html`<span class="average">${this.average}</span>` : nothing}
      </div>
      <mc-bar-chart
        .bars=${this.bars}
        .height=${this.framed ? FRAMED_CHART_HEIGHT : RAIL_CHART_HEIGHT}
      ></mc-bar-chart>`;
  }
}
