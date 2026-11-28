import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import type { CarryInRow, SchemeCardRef } from "../../../view/campaign-side-scheme-model.js";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import { sectionTextIn } from "../shared/section-text.js";
import "../mc-briefing-inspect-chip/mc-briefing-inspect-chip.js";
import { McBriefingCarryInStyles } from "./mc-briefing-carry-in.styles.js";

/** Each distinct card once, in the order named, with how many times. */
function countedOf(cards: readonly SchemeCardRef[]): readonly { card: SchemeCardRef; count: number }[] {
  const counts = new Map<string, { card: SchemeCardRef; count: number }>();
  for (const card of cards) {
    const seen = counts.get(card.cardId as string);
    if (seen) seen.count += 1;
    else counts.set(card.cardId as string, { card, count: 1 });
  }
  return [...counts.values()];
}

/**
 * # Briefing carry-in
 * One fact the side-scheme section carries in from the campaign log: its few words, a detail line and each card it names as an
 * Inspect chip (a repeat reads "x2"). Framed, with no fill, so the page shows through. A chip reads the card and answers nothing.
 *
 * @element mc-briefing-carry-in
 * @prop carry - `CarryInRow`.
 * @fires mc-briefing - `{ type: "inspect", cardId, name }`.
 */
export class McBriefingCarryIn extends LitElement {
  static override styles = [ThemeStyles, McBriefingCarryInStyles];

  static override properties: PropertyDeclarations = {
    carry: { attribute: false },
  };

  declare carry: CarryInRow | null;

  constructor() {
    super();
    this.carry = null;
    new BriefingRelay(this);
  }

  override render() {
    const carry = this.carry;
    if (!carry) return nothing;
    const text = sectionTextIn();
    const counted = countedOf(carry.cards);
    return html`<span class="title">${text.carryTitle(carry.title)}</span>
      ${carry.detail ? html`<span class="detail">${text.carryDetail(carry.detail)}</span>` : nothing}
      ${
        counted.length > 0
          ? html`<div class="chips">
              ${counted.map(
                ({ card, count }) =>
                  html`<mc-briefing-inspect-chip
                    .stop=${`carry:${carry.key}:${card.cardId as string}`}
                    .label=${count > 1 ? `${card.name} ×${count}` : card.name}
                    .card=${{ cardId: card.cardId as string, name: card.name }}
                  ></mc-briefing-inspect-chip>`,
              )}
            </div>`
          : nothing
      }`;
  }
}
