import { html, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { BuilderElement } from "../shared/BuilderElement.js";
import type { BuilderTab, RailTab } from "../shared/deck-builder-events.types.js";
import { McBuilderTabsStyles } from "./mc-builder-tabs.styles.js";
import type { BuilderTabsModel } from "./mc-builder-tabs.types.js";

/**
 * # Builder tabs
 * The strip of tabs, on a tab rail: the narrow layout's Pool, Deck (with its live count, so the deck is seen growing while
 * on the pool) and From your games (issue #544), or the wide deck rail's Your deck and From your games. LB and RB step them
 * on a pad; their glyphs hang over the strip while a keyboard or pad is in use.
 *
 * Focus stops: `tab:<id>` or `rail:<id>`.
 *
 * @element mc-builder-tabs
 * @prop model - The strip (`BuilderTabsModel`).
 * @fires mc-deck-builder - `tab` (a `tab:` strip) or `rail-tab` (a `rail:` strip).
 */
export class McBuilderTabs extends BuilderElement {
  static override styles = [ThemeStyles, McBuilderTabsStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: BuilderTabsModel | null;

  constructor() {
    super();
    this.model = null;
  }

  #press = (event: CustomEvent<{ id: string }>): void => {
    event.stopPropagation();
    const { id } = event.detail;
    this.emit(
      this.model?.prefix === "rail:"
        ? { type: "rail-tab", tab: id as RailTab }
        : { type: "tab", tab: id as BuilderTab },
    );
  };

  override render() {
    const model = this.model;
    if (!model) return nothing;
    return html`${
        model.glyph ? html`<div class="hint"><mc-glyph-hint .glyph=${model.glyph}></mc-glyph-hint></div>` : nothing
      }
      <mc-tab-rail
        .tabs=${model.tabs}
        .selected=${model.selected}
        .prefix=${model.prefix}
        @mc-activate=${this.#press}
      ></mc-tab-rail>`;
  }
}
