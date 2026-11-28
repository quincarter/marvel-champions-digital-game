import { html, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { RulesElement } from "../shared/RulesElement.js";
import { cardTile, RulesTileStyles } from "../shared/rules-tile.js";
import { McRulesCardSetStyles } from "./mc-rules-card-set.styles.js";
import type { McRulesCardSetProps, RulesCardSetModel } from "./mc-rules-card-set.types.js";

/**
 * # Rules card set
 * One encounter set of the Card list: a Bangers heading (name, card count) with a rule filling the rest of its row, over a
 * wrapped grid of card tiles. A tile is a focus stop (`row:card:<set>:<card>`) that opens Inspect on a tap, a hold or the
 * route's Enter. The browser skips drawing a set that is far off screen (`content-visibility`), so a thousand tiles scroll.
 *
 * @element mc-rules-card-set
 * @fires mc-rules - `{ type: "card", key }`.
 */
export class McRulesCardSet extends RulesElement implements McRulesCardSetProps {
  static override styles = [ThemeStyles, RulesTileStyles, McRulesCardSetStyles];

  static override properties: PropertyDeclarations = {
    set: { attribute: false },
  };

  declare set: RulesCardSetModel | null;

  constructor() {
    super();
    this.set = null;
  }

  readonly #press = (key: string): void => this.emit({ type: "card", key });

  override render() {
    const set = this.set;
    if (!set) return html``;
    return html`<h3 class="heading"><span>${set.heading}</span></h3>
      <div class="grid">
        ${repeat(
          set.tiles,
          (tile) => tile.key,
          (tile) => html`<div class="cell">${cardTile(tile, this.#press)}</div>`,
        )}
      </div>`;
  }
}
