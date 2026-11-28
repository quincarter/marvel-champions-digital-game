import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import { pastGamesEvent } from "../../../components/past-games/shared/past-games-events.types.js";
import type { McPastGameDetails } from "../../../components/past-games/mc-past-game-details/McPastGameDetails.js";
import type { McPastGamesList } from "../../../components/past-games/mc-past-games-list/McPastGamesList.js";
import type { McPastGamesSearch } from "../../../components/past-games/mc-past-games-search/McPastGamesSearch.js";
import "../../../components/past-games/mc-past-game-details/mc-past-game-details.js";
import "../../../components/past-games/mc-past-games-file-button/mc-past-games-file-button.js";
import "../../../components/past-games/mc-past-games-filters/mc-past-games-filters.js";
import "../../../components/past-games/mc-past-games-list/mc-past-games-list.js";
import "../../../components/past-games/mc-past-games-search/mc-past-games-search.js";
import { McPastGamesPageStyles } from "./mc-past-games-page.styles.js";
import type { PastGamesPageModel } from "./mc-past-games-page.types.js";

/**
 * # Past games (page)
 * The whole screen as one element that only composes sections and holds no state: the ink top bar (Back, the title and
 * "Open a replay file" in its end slot), the filter tabs, the export button and search box, then the finished games and,
 * wide, the details panel beside them. A phone's details are a popup the page stands over everything. The scene mounts
 * it in a `DomRegion`, sets `model` and listens for `mc-past-games` (and the search field's own `mc-search` and
 * `mc-search-focus`, which pass through), `mc-image-error` and the card events its pictures raise.
 *
 * Needs `@mc/ui` defined (`mc-top-bar`, `mc-toast`).
 *
 * @element mc-past-games-page
 * @prop model - `PastGamesPageModel`.
 * @attr side - Set from the model: the details beside the list.
 * @attr phone - Set from the model: the phone's bar and gutters.
 * @fires mc-past-games - Any section's `PastGamesEventDetail`.
 */
export class McPastGamesPage extends LitElement {
  static override styles = [ThemeStyles, McPastGamesPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    side: { type: Boolean, reflect: true },
    phone: { type: Boolean, reflect: true },
  };

  declare model: PastGamesPageModel | null;
  declare side: boolean;
  declare phone: boolean;

  constructor() {
    super();
    this.model = null;
    this.side = false;
    this.phone = false;
  }

  protected override willUpdate(): void {
    this.side = this.model?.side ?? false;
    this.phone = this.model?.phone ?? false;
  }

  /** The list's scrolling box. */
  get listScroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McPastGamesList>("mc-past-games-list")?.scroller ?? null;
  }

  /** The details' words' scrolling box (the side panel's, or the open popup's). */
  get detailsScroller(): HTMLElement | null {
    return this.renderRoot.querySelector<McPastGameDetails>("mc-past-game-details")?.scroller ?? null;
  }

  /** The search field, for the scene's caret rules. */
  get searchField(): McPastGamesSearch["field"] {
    return this.renderRoot.querySelector<McPastGamesSearch>("mc-past-games-search")?.field ?? null;
  }

  /** Scrolls a game's row to the middle of the list. */
  centerRow(id: string): void {
    this.renderRoot.querySelector<McPastGamesList>("mc-past-games-list")?.centerRow(id);
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const popup = !m.side && m.details !== null;
    return html`
      <mc-top-bar
        class="bar"
        .heading=${m.bar.title}
        .backLabel=${m.bar.backLabel}
        .backGlyph=${hintGlyphOf(m.bar.backGlyph)}
        .titleDrop=${m.bar.titleDrop}
        .titleMaxRight=${m.bar.titleMaxRight}
        ?compact=${m.phone}
        @mc-press=${() => this.dispatchEvent(pastGamesEvent({ type: "back" }))}
      >
        <mc-past-games-file-button slot="end" ?phone=${m.phone} .model=${m.file}></mc-past-games-file-button>
      </mc-top-bar>
      <div class="body">
        <div class="content">
          <mc-past-games-filters
            .tabs=${m.filters.tabs}
            .selected=${m.filters.selected}
            .glyph=${m.filters.glyph}
          ></mc-past-games-filters>
          <mc-past-games-search .model=${m.search}></mc-past-games-search>
          <div class="main">
            <mc-past-games-list class="list" .model=${m.list}></mc-past-games-list>
            ${
              m.side && m.details
                ? html`<mc-past-game-details class="details" .model=${m.details}></mc-past-game-details>`
                : nothing
            }
          </div>
        </div>
      </div>
      ${popup ? html`<mc-past-game-details popup .model=${m.details}></mc-past-game-details>` : nothing}
      <mc-toast .text=${m.status}></mc-toast>
    `;
  }
}
