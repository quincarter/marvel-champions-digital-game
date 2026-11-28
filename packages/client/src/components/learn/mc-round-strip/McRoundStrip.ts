import { html, LitElement, type PropertyDeclarations } from "lit";
import { McRoundStripStyles } from "./mc-round-strip.styles.js";
import type { RoundStripProps } from "./mc-round-strip.types.js";

/**
 * # Round strip
 * How to win's EVERY ROUND strip: a small capitals label over the round's beats as pills, in order, with an arrow
 * between each (you act and draw up, then the villain acts). The first pill is ink, the next Hero Red. A long
 * translation wraps inside its pill, the longer taking what the shorter leaves.
 *
 * @element mc-round-strip
 * @attr label - EVERY ROUND, already translated.
 * @prop steps - The beats' words, in order, already translated.
 */
export class McRoundStrip extends LitElement implements RoundStripProps {
  static override styles = [McRoundStripStyles];

  static override properties: PropertyDeclarations = {
    label: { type: String },
    steps: { attribute: false },
  };

  declare label: string;
  declare steps: readonly string[];

  constructor() {
    super();
    this.label = "";
    this.steps = [];
  }

  override render() {
    const last = this.steps.length - 1;
    return html`<div class="strip">
      <div class="label">${this.label}</div>
      <div class="steps">
        ${this.steps.map(
          (step, index) =>
            html`<span class="pill" data-step=${index === 0 ? "ink" : "red"}>${step}</span>${
                index < last ? html`<span class="arrow" aria-hidden="true">▸</span>` : ""
              }`,
        )}
      </div>
    </div>`;
  }
}
