import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McPastGameSummaryStyles } from "./mc-past-game-summary.styles.js";
import type {
  McPastGameSummaryProps,
  PastGameSummaryModel,
  PastGameSummarySize,
} from "./mc-past-game-summary.types.js";

/**
 * # Past game summary
 * How a game went, in words: the result (WON, LOST, CONCEDED) with its reason beside it, the title, when and how long it
 * was played, which heroes fell and which stood. On a row it is compact; in the details (`size="detail"`) the result is
 * large over its reason and the campaign line is added. The result is a word first: the colour only agrees with it.
 *
 * @element mc-past-game-summary
 * @prop model - The words (`PastGameSummaryModel`).
 * @attr size - row (default) | detail.
 */
export class McPastGameSummary extends LitElement implements McPastGameSummaryProps {
  static override styles = [McPastGameSummaryStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    size: { type: String, reflect: true },
  };

  declare model: PastGameSummaryModel | null;
  declare size: PastGameSummarySize;

  constructor() {
    super();
    this.model = null;
    this.size = "row";
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="head">
        <span class="result" data-tone=${m.tone}>${m.result}</span>
        <span class="reason">${m.reason}</span>
      </div>
      <div class="title">${m.title}</div>
      <div class="when">${m.when}</div>
      ${m.campaign ? html`<div class="campaign">${m.campaign}</div>` : nothing}
      ${m.fates ? html`<div class="fates">${m.fates}</div>` : nothing}`;
  }
}
