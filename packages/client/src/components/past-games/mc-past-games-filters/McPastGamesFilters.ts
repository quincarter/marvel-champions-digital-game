import { ThemeStyles, type ControlGlyph, type TabRailTab } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { PAST_GAME_FILTERS, type PastGameFilter } from "../../../view/past-games-model.js";
import { PastGamesElement } from "../shared/PastGamesElement.js";
import { McPastGamesFiltersStyles } from "./mc-past-games-filters.styles.js";
import type { McPastGamesFiltersProps } from "./mc-past-games-filters.types.js";

/**
 * # Past games filters
 * The tabs along the top: every game, only the wins or only the losses, each with its count. A tab is a stop,
 * `filter:<all|won|lost>`. On a pad, LB / RB step them: the glyph hangs under the strip's right end.
 *
 * Needs `@mc/ui` defined (`mc-tab-rail`, `mc-glyph-hint`).
 *
 * @element mc-past-games-filters
 * @prop tabs - The tabs (`TabRailTab`).
 * @attr selected - The chosen filter.
 * @prop glyph - The LB / RB hint (`ControlGlyph`), or none.
 * @fires mc-past-games - `{ type: "filter", filter }`.
 */
export class McPastGamesFilters extends PastGamesElement implements McPastGamesFiltersProps {
  static override styles = [ThemeStyles, McPastGamesFiltersStyles];

  static override properties: PropertyDeclarations = {
    tabs: { attribute: false },
    selected: { type: String },
    glyph: { attribute: false },
  };

  declare tabs: readonly TabRailTab[];
  declare selected: PastGameFilter;
  declare glyph: ControlGlyph | undefined;

  constructor() {
    super();
    this.tabs = [];
    this.selected = "all";
    this.glyph = undefined;
  }

  #pick(event: CustomEvent<{ id: string }>): void {
    event.stopPropagation();
    const filter = PAST_GAME_FILTERS.find((id) => id === event.detail.id);
    if (filter) this.emit({ type: "filter", filter });
  }

  override render() {
    return html`<mc-tab-rail
        .tabs=${this.tabs}
        .selected=${this.selected}
        prefix="filter:"
        @mc-activate=${(event: CustomEvent<{ id: string }>) => this.#pick(event)}
      ></mc-tab-rail>
      ${this.glyph ? html`<div class="hint"><mc-glyph-hint .glyph=${this.glyph}></mc-glyph-hint></div>` : nothing}`;
  }
}
