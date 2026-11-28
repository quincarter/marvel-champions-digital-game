import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { DecksElement } from "../shared/DecksElement.js";
import { DecksSharedStyles } from "../shared/decks-shared.styles.js";
import type { DecksCommunityModel } from "../decks.types.js";
import { McDecksCommunityStyles } from "./mc-decks-community.styles.js";

/**
 * # Decks community
 * A community deck's rail, in the stats pane's place: whose deck it is and where it comes from (a MarvelCDB author's deck, not
 * an official precon), the aspect stamps and what this game can say about it (Tested, or what keeps it from being offered), when
 * it was published, the author's own notes (how they play it; a long write-up scrolls natively, with a cue), the MarvelCDB link
 * as words and as buttons, and at the foot Check and Add (an editable copy).
 *
 * Focus stops: `stats-preview` (narrow), `stats-copy-link`, `stats-open-link`, `stats-check`, `stats-add`.
 *
 * @element mc-decks-community
 * @prop model - The deck (`DecksCommunityModel`).
 * @fires mc-decks - `{ type: "action", action: "stats-check" | "stats-add" | "stats-preview" | "stats-copy-link" | "stats-open-link" }`.
 */
export class McDecksCommunity extends DecksElement {
  static override styles = [DecksSharedStyles, McDecksCommunityStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    scrolls: { state: true },
  };

  declare model: DecksCommunityModel | null;
  /** The notes are longer than their box: the cue says they scroll. */
  declare scrolls: boolean;

  constructor() {
    super();
    this.model = null;
    this.scrolls = false;
  }

  protected override updated(): void {
    const notes = this.renderRoot.querySelector<HTMLElement>(".notes");
    const scrolls = notes !== null && notes.scrollHeight > notes.clientHeight + 1;
    if (scrolls !== this.scrolls) this.scrolls = scrolls;
  }

  override render() {
    const deck = this.model;
    if (!deck) return nothing;
    return html`<div class="top">
        <span class="from">${deck.from}</span>
        <h3 class="name">${deck.name}</h3>
        <span class="credit">${deck.credit}</span>
        <div class="stamps">
          ${deck.stamps.map(
            (stamp) =>
              html`<span class="stamp" style=${styleMap({ "--stamp-fill": stamp.fill, "--stamp-ink": stamp.ink })}
                >${stamp.text}</span
              >`,
          )}
        </div>
        <span class="meta">${deck.meta}</span>
        ${deck.why ? html`<p class="why"><span aria-hidden="true">✕</span> ${deck.why}</p>` : nothing}
      </div>
      <div class="notes-head">
        <span>${deck.notesHeading}</span>
        ${this.scrolls ? html`<span class="cue">${deck.scrollCue}</span>` : nothing}
      </div>
      <div class="notes" tabindex="-1">
        ${deck.notes ? html`<p>${deck.notes}</p>` : html`<p class="none">${deck.noNotes}</p>`}
      </div>
      <span class="url">${deck.url}</span>
      <div class="links">${deck.links.map((link) => this.button(link, { kind: "quiet", size: 11 }))}</div>
      <div class="foot">
        <div class="check">${this.button(deck.check, { kind: "onInk", size: 11 })}</div>
        <div class="add">${this.button(deck.add, { kind: "primary", display: true })}</div>
      </div>`;
  }
}
