import { html, LitElement, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { McStatsAspectStampsStyles } from "./mc-stats-aspect-stamps.styles.js";
import type { McStatsAspectStampsProps, StatsAspectStamp } from "./mc-stats-aspect-stamps.types.js";

/**
 * # Aspect stamps
 * The aspects a hero has been played with, each as its colour stamp with its name on it and, beside it, what you did with
 * it ("5 games · 3 won"). The word is on the stamp, so the aspect is never told by colour alone.
 *
 * @element mc-stats-aspect-stamps
 * @attr caption - "ASPECTS".
 * @prop aspects - The stamps (`StatsAspectStamp`).
 */
export class McStatsAspectStamps extends LitElement implements McStatsAspectStampsProps {
  static override styles = McStatsAspectStampsStyles;

  static override properties: PropertyDeclarations = {
    caption: { type: String },
    aspects: { attribute: false },
  };

  declare caption: string;
  declare aspects: readonly StatsAspectStamp[];

  constructor() {
    super();
    this.caption = "";
    this.aspects = [];
  }

  override render() {
    return html`<span class="caption">${this.caption}</span> ${this.aspects.map(
        (entry) =>
          html`<span class="entry">
            <span class="stamp" style=${styleMap({ "--stamp-fill": entry.fill, "--stamp-ink": entry.ink })}
              >${entry.label}</span
            >
            <span class="detail">${entry.detail}</span>
          </span>`,
      )}`;
  }
}
