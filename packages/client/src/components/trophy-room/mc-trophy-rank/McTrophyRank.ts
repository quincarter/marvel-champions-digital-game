import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import type { TrophyHeader } from "../../../view/trophy-room-model.js";
import { McTrophyRankStyles } from "./mc-trophy-rank.styles.js";
import type { McTrophyRankProps } from "./mc-trophy-rank.types.js";

/**
 * # Trophy rank
 * The ink header over the list: the player's rank and lifetime points, the rank's name in Bangers, how many points to the
 * next rank and how many achievements are earned, and a bar to the next rank (`mc-progress-bar`, in paper on the ink).
 *
 * Needs `@mc/ui` defined (`mc-progress-bar`).
 *
 * @element mc-trophy-rank
 * @prop model - The header (`TrophyHeader`).
 * @attr phone - A smaller title and tighter padding.
 */
export class McTrophyRank extends LitElement implements McTrophyRankProps {
  static override styles = [McTrophyRankStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    phone: { type: Boolean, reflect: true },
  };

  declare model: TrophyHeader | null;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.phone = false;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="top">
        <span class="rank">${m.rankLabel.toUpperCase()}</span>
        <span class="points">${m.pointsLabel.toUpperCase()}</span>
      </div>
      <div class="title">${m.title.toUpperCase()}</div>
      <div class="caption">
        <span class="next">${m.nextLabel}</span>
        <span class="earned">${m.earnedLabel}</span>
      </div>
      <mc-progress-bar .fraction=${m.fraction} .label=${m.nextLabel}></mc-progress-bar>`;
  }
}
