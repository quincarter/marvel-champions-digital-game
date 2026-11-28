import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { hintGlyphOf } from "../../../dom/hint-glyph.js";
import {
  DECKS_EVENT,
  type DecksEvent,
  type DecksPageModel,
  type DecksTab,
} from "../../../components/decks/decks.types.js";
import "../../../components/decks/mc-decks-cards/mc-decks-cards.js";
import "../../../components/decks/mc-decks-list/mc-decks-list.js";
import "../../../components/decks/mc-decks-stats/mc-decks-stats.js";
import { McDecksPageStyles } from "./mc-decks-page.styles.js";

/**
 * # Decks & Collection
 * The page: it only composes the sections and holds no state. The ink header, then either three panes side by side (the deck
 * list with its Import / Export box, the card pool, and the ink stats rail) or, narrow, one pane at a time behind the tab rail
 * (Decks / Cards / Stats). Layout is CSS; `model.wide` (the scene's form factor) only picks which arrangement applies.
 *
 * @element mc-decks-page
 * @prop model - What the page shows (`DecksPageModel`).
 * @fires mc-decks - every section's event, as it bubbles; the tab rail's as `{ type: "tab", tab }`.
 */
export class McDecksPage extends LitElement {
  static override styles = [ThemeStyles, McDecksPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    wide: { type: Boolean, reflect: true },
  };

  declare model: DecksPageModel | null;
  declare wide: boolean;

  constructor() {
    super();
    this.model = null;
    this.wide = false;
  }

  override willUpdate(): void {
    this.wide = this.model?.wide ?? false;
  }

  /** The section the scene reads back from (the list's scroller, the grid, the search fields), by its tag. */
  section<T extends HTMLElement = HTMLElement>(tag: string): T | null {
    return this.renderRoot.querySelector<T>(tag);
  }

  #pane(page: DecksPageModel, tab: DecksTab) {
    switch (tab) {
      case "decks":
        return html`<mc-decks-list class="list" .model=${page.list}></mc-decks-list>`;
      case "cards":
        return html`<mc-decks-cards class="cards" .model=${page.cards}></mc-decks-cards>`;
      case "stats":
        return html`<mc-decks-stats class="stats" .model=${page.stats}></mc-decks-stats>`;
    }
  }

  override render() {
    const page = this.model;
    if (!page) return nothing;
    const head = page.header;
    const say = (action: "back" | "player-stats") => (event: Event) => {
      event.stopPropagation();
      this.dispatchEvent(
        new CustomEvent<DecksEvent>(DECKS_EVENT, { detail: { type: "action", action }, bubbles: true, composed: true }),
      );
    };
    return html`<mc-top-bar
        class="header"
        italic
        ?compact=${!page.wide}
        .heading=${head.title}
        .right=${head.poolMeta ?? ""}
        .backLabel=${head.backLabel}
        .backGlyph=${hintGlyphOf(head.backGlyph)}
        @mc-press=${say("back")}
      >
        <mc-hint-button
          slot="end"
          class="stats-button"
          data-stop="player-stats"
          kind="onInk"
          display
          .label=${head.statsLabel}
          .glyph=${hintGlyphOf(head.statsGlyph)}
          @mc-press=${say("player-stats")}
        ></mc-hint-button>
      </mc-top-bar>
      ${
        page.wide
          ? html`<main class="panes">
              ${this.#pane(page, "decks")} ${this.#pane(page, "cards")} ${this.#pane(page, "stats")}
            </main>`
          : html`<main class="column">
              ${
                page.tabsGlyph
                  ? html`<div class="tab-hint"><mc-glyph-hint .glyph=${page.tabsGlyph}></mc-glyph-hint></div>`
                  : nothing
              }
              <mc-tab-rail
                class="tabs"
                .tabs=${page.tabs}
                .selected=${page.tab}
                @mc-activate=${(event: CustomEvent<{ id: string }>) => {
                  event.stopPropagation();
                  this.dispatchEvent(
                    new CustomEvent<DecksEvent>(DECKS_EVENT, {
                      detail: { type: "tab", tab: event.detail.id as DecksTab },
                      bubbles: true,
                      composed: true,
                    }),
                  );
                }}
              ></mc-tab-rail>
              <div class="content" data-pane=${page.tab}>${this.#pane(page, page.tab)}</div>
            </main>`
      }`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-decks-page": McDecksPage;
  }
}
