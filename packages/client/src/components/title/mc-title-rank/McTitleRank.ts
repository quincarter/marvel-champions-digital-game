import { html, nothing, type PropertyDeclarations } from "lit";
import { McPress } from "@mc/ui";
import type { TitleRankInput } from "./mc-title-rank.types.js";
import { McTitleRankStyles } from "./mc-title-rank.styles.js";

/**
 * # Title rank card
 * The rank card: the rank, the lifetime points and a thin bar to the next rank. A tap opens the Trophy Room (the page
 * gives it the stop and action `rank-badge`). Its words are the same at every size; a compact card (a phone strip) is
 * one line shorter.
 *
 * @element mc-title-rank
 * @prop input - What it says (`TitleRankInput`).
 * @attr up - A rank-up is being announced (reflected).
 * @fires mc-pressed - `PressDetail`, its `action` the focus stop key.
 */
export class McTitleRank extends McPress {
  static override styles = McTitleRankStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    input: { attribute: false },
    up: { type: Boolean, reflect: true },
  };

  declare input: TitleRankInput | null;
  declare up: boolean;

  constructor() {
    super();
    this.input = null;
    this.up = false;
  }

  protected override willUpdate(): void {
    this.up = this.input?.up ?? false;
    if (this.input) this.setAttribute("aria-label", this.input.summary);
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const fill = input.fraction > 0 ? `max(2px, calc((100% - 2px) * ${input.fraction}))` : "0";
    return html`<div class="plate">
      <div class="first">
        <span class="label">${input.label}</span>
        ${input.points !== null ? html`<span class="points">${input.points}</span>` : nothing}
      </div>
      ${input.compact ? nothing : html`<div class="title">${input.title}</div>`}
      ${
        input.up || input.next === null
          ? nothing
          : html`<div class="bar"><div class="fill" style=${`width:${fill}`}></div></div>
              <div class="caption">${input.next}</div>`
      }
    </div>`;
  }
}
