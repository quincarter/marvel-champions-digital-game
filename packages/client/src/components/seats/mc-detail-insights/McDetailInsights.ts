import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { SeatsDetailModel } from "../seats.types.js";
import { McDetailInsightsStyles } from "./mc-detail-insights.styles.js";

/** One insight line of the detail panel. */
export type InsightLine = SeatsDetailModel["insights"][number];

/**
 * # Insights
 * The lines under the hero's facts: Team-Up pair notes and why the hovered hero is recommended (`meta`), and conflicts
 * (`caution`). A caution carries a leading "!" and a heavier weight, so it is never told apart by colour alone. The list
 * is a polite live region: it is rebuilt as the pointer or focus moves over the roster.
 *
 * @element mc-detail-insights
 * @prop insights - The lines, already worded; empty draws nothing.
 */
export class McDetailInsights extends LitElement {
  static override styles = [McDetailInsightsStyles];

  static override properties: PropertyDeclarations = { insights: { attribute: false } };

  declare insights: readonly InsightLine[];

  constructor() {
    super();
    this.insights = [];
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("aria-live", "polite");
  }

  override render() {
    if (this.insights.length === 0) return nothing;
    return html`<ul class="lines">
      ${this.insights.map(
        (line) =>
          html`<li class="line" data-tone=${line.tone}>
            ${line.tone === "caution" ? html`<span class="mark" aria-hidden="true">!</span>` : nothing}<span
              class="text"
              >${line.text}</span
            >
          </li>`,
      )}
    </ul>`;
  }
}
