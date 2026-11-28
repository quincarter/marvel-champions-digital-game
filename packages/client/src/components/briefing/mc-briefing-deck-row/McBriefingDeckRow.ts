import { html, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { McPress } from "@mc/ui";
import { BriefingPressStyles } from "../shared/briefing.styles.js";
import { McBriefingDeckRowStyles } from "./mc-briefing-deck-row.styles.js";
import type { DeckRowModel } from "./mc-briefing-deck-row.types.js";

/**
 * # Briefing deck row
 * One seat deck on the Decks panel: "HERO · ASPECT" in Bangers, the deck count and a "▸". The whole row is a button into that
 * seat own deck (a tap raises `mc-pressed` with an `edit-decks` action; the press and the lift of a swipe are not a tap). A row
 * naming a problem wraps it under the hero in red behind a "!" (words and a mark, never the red wash alone). A narrow row puts
 * the count on its own line instead of over the name.
 *
 * @element mc-briefing-deck-row
 * @prop row - `DeckRowModel`.
 * @fires mc-pressed - `PressDetail` whose `action` is `{ type: "edit-decks", seat }`.
 */
export class McBriefingDeckRow extends McPress {
  static override styles = [BriefingPressStyles, McBriefingDeckRowStyles];

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    row: { attribute: false },
  };

  declare row: DeckRowModel | null;

  constructor() {
    super();
    this.row = null;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("row")) this.action = this.row ? { type: "edit-decks", seat: this.row.seat } : null;
  }

  override render() {
    const row = this.row;
    if (!row) return nothing;
    return html`<div class=${row.problem ? "row problem" : "row"}>
      <span class="title display">${row.title}</span>
      <span class="count">${row.count}</span>
      <span class="go" aria-hidden="true">▸</span>
      ${row.problem ? html`<span class="why">! ${row.problem}</span>` : nothing}
    </div>`;
  }
}
