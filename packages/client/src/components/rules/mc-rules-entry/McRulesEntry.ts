import { html, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { tapped, ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { RulesElement } from "../shared/RulesElement.js";
import { cardTile, RulesTileStyles } from "../shared/rules-tile.js";
import { McRulesEntryStyles } from "./mc-rules-entry.styles.js";
import type { McRulesEntryProps, RulesEntryModel } from "./mc-rules-entry.types.js";

/**
 * # Rules entry
 * One glossary term as a bordered card: the term (Bangers), its definition, its source and any player note, the "Added in
 * ..." link (with no game running) and a strip of the cards that carry it right now, each opening Inspect. A status
 * (Stunned, Confused, Tough) also wears a colored stripe, but the word is always the term itself. The card is a focus stop,
 * `row:entry:<id>`: Enter follows its origin link, or else opens its first card, and Inspect opens the first card.
 *
 * @element mc-rules-entry
 * @fires mc-rules - `card` (a tile) and `origin` (the link).
 */
export class McRulesEntry extends RulesElement implements McRulesEntryProps {
  static override styles = [ThemeStyles, RulesTileStyles, McRulesEntryStyles];

  static override properties: PropertyDeclarations = {
    entry: { attribute: false },
  };

  declare entry: RulesEntryModel | null;

  constructor() {
    super();
    this.entry = null;
  }

  protected override willUpdate(): void {
    if (this.entry) this.dataset.stop = `row:entry:${this.entry.id}`;
  }

  /** What Enter does: the "Added in" link when it has one, else the first card; a bare term does nothing. */
  override click(): void {
    const entry = this.entry;
    if (!entry) return;
    if (entry.origin?.boxId) this.emit({ type: "origin", boxId: entry.origin.boxId });
    else this.inspect();
  }

  /** Inspect: the first card of the strip. */
  inspect(): void {
    const first = this.entry?.tiles[0];
    if (first) this.emit({ type: "card", key: first.key });
  }

  readonly #press = (key: string): void => this.emit({ type: "card", key });

  override render() {
    const entry = this.entry;
    if (!entry) return nothing;
    const origin = entry.origin;
    return html`<div class=${entry.status ? `card status ${entry.status}` : "card"}>
      <div class="term">${entry.name}</div>
      <p class="definition">${entry.definition}</p>
      <p class="cite">${entry.cite}</p>
      ${entry.note ? html`<p class="note">${entry.note}</p>` : nothing}
      ${
        origin
          ? origin.boxId
            ? html`<p class="origin link" ${tapped(() => this.emit({ type: "origin", boxId: origin.boxId! }))}>
                ${origin.text} ▸
              </p>`
            : html`<p class="origin">${origin.text}</p>`
          : nothing
      }
      ${
        entry.tiles.length > 0
          ? html`<div class="strip">
              ${repeat(
                entry.tiles,
                (tile) => tile.key,
                (tile) => html`<div class="thumb">${cardTile(tile, this.#press)}</div>`,
              )}
              ${entry.more > 0 ? html`<span class="more">${t("rules.thumbsMore", { count: entry.more })}</span>` : nothing}
            </div>`
          : nothing
      }
    </div>`;
  }
}
