import { html, nothing, type PropertyDeclarations } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { DecksElement } from "../shared/DecksElement.js";
import { DecksSharedStyles } from "../shared/decks-shared.styles.js";
import type { DecksHeaderModel } from "../decks.types.js";
import { McDecksHeaderStyles } from "./mc-decks-header.styles.js";

/**
 * # Decks header
 * The ink bar across the top of Decks & Collection: Back, the Bangers title, the pool size ("CARD POOL . 612 CARDS", not on a
 * phone) and "Your stats". The scene drops the title under, or ends it before, the dark mode tab (`titleDrop`,
 * `titleMaxRight`). Each button carries its pad glyph while a keyboard or pad is in use.
 *
 * Focus stops: `back`, `player-stats`.
 *
 * @element mc-decks-header
 * @prop model - The bar (`DecksHeaderModel`).
 * @fires mc-decks - `{ type: "action", action: "back" | "player-stats" }`.
 */
export class McDecksHeader extends DecksElement {
  static override styles = [DecksSharedStyles, McDecksHeaderStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: DecksHeaderModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const bar = this.model;
    if (!bar) return nothing;
    return html`<header class="bar">
      <div class="back">
        ${this.button({ action: "back", label: bar.backLabel, glyph: bar.backGlyph }, { kind: "onInk", display: true })}
      </div>
      <h1
        class="title"
        style=${styleMap({
          "--drop": `${bar.titleDrop}px`,
          "--max-right": bar.titleMaxRight === null ? "none" : `${bar.titleMaxRight}px`,
        })}
      >
        <span>${bar.title}</span>
      </h1>
      ${bar.poolMeta ? html`<span class="meta">${bar.poolMeta}</span>` : nothing}
      <div class="stats">
        ${this.button(
          { action: "player-stats", label: bar.statsLabel, glyph: bar.statsGlyph },
          { kind: "onInk", display: true },
        )}
      </div>
    </header>`;
  }
}
