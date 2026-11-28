import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import "../mc-briefing-deck-row/mc-briefing-deck-row.js";
import { McBriefingDecksStyles } from "./mc-briefing-decks.styles.js";
import type { DecksModel } from "./mc-briefing-decks.types.js";

/**
 * # Briefing decks
 * The Decks panel: one row per seat (`mc-briefing-deck-row`), each a way into that seat own deck, and the line under it about
 * what counts toward the deck size. While the issue waits on a call or is composing, the panel says so instead of listing decks.
 *
 * @element mc-briefing-decks
 * @prop model - `DecksModel`.
 * @fires mc-briefing - `{ type: "edit-decks", seat }`.
 */
export class McBriefingDecks extends LitElement {
  static override styles = [ThemeStyles, McBriefingDecksStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: DecksModel | null;

  constructor() {
    super();
    this.model = null;
    new BriefingRelay(this);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<mc-section-heading .label=${t("briefing.decks").toLocaleUpperCase()}></mc-section-heading>
      ${
        m.waiting !== null
          ? html`<p class="note">${m.waiting}</p>`
          : html`<div class="list">
                ${m.rows.map(
                  (row) =>
                    html`<mc-briefing-deck-row .stop=${`deck-seat-${row.seat}`} .row=${row}></mc-briefing-deck-row>`,
                )}
              </div>
              <p class="note">${m.note}</p>`
      }`;
  }
}
