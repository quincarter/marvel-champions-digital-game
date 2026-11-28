import { ThemeStyles } from "@mc/ui";
import { html, type PropertyDeclarations } from "lit";
import { PastGamesElement } from "../shared/PastGamesElement.js";
import { McPastGamesSearchStyles } from "./mc-past-games-search.styles.js";
import type { McPastGamesSearchProps, PastGamesSearchModel } from "./mc-past-games-search.types.js";

const EMPTY: PastGamesSearchModel = {
  value: "",
  placeholder: "",
  clearLabel: "",
  exportLabel: "",
  exportDisabled: true,
};

/**
 * # Past games search
 * The export button and the search box under the tabs: "Export for MC Tracker (CSV)" (the games the list shows now) and a
 * real field that finds a game by hero, villain, deck, a card played or the year (fuzzy and accent-free: the matching is
 * the client's, `view/deck-search.ts`). Side by side where there is room (the element's own width, a container query),
 * else one under the other. Stops: `export-tracker` and `search`.
 *
 * The field's own `mc-search` and `mc-search-focus` events pass through: they are guarded already, and the scene hands it
 * back the text it accepted as `value`, never the field's draft.
 *
 * Needs `@mc/ui` defined (`mc-button`, `mc-search-field`).
 *
 * @element mc-past-games-search
 * @prop model - The words and state (`PastGamesSearchModel`).
 * @fires mc-past-games - `{ type: "export-tracker" }`.
 * @fires mc-search - The field's, with the text.
 * @fires mc-search-focus - The caret went into or left the field.
 */
export class McPastGamesSearch extends PastGamesElement implements McPastGamesSearchProps {
  static override styles = [ThemeStyles, McPastGamesSearchStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: PastGamesSearchModel;

  constructor() {
    super();
    this.model = EMPTY;
  }

  /** The search field, for the scene's caret rules (Escape, a pad's B). */
  get field(): (HTMLElement & { readonly focused: boolean; readonly text: string; blur(): void }) | null {
    return this.renderRoot.querySelector("mc-search-field");
  }

  override render() {
    const m = this.model;
    return html`<div class="row">
      <mc-button
        kind="secondary"
        plain
        data-stop="export-tracker"
        data-key="export-tracker"
        ?disabled=${m.exportDisabled}
        .label=${m.exportLabel}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          this.emit({ type: "export-tracker" });
        }}
      ></mc-button>
      <mc-search-field
        data-stop="search"
        escape-clears
        .value=${m.value}
        .placeholder=${m.placeholder}
        .focusPlaceholder=${m.focusPlaceholder ?? ""}
        .clearLabel=${m.clearLabel}
      ></mc-search-field>
    </div>`;
  }
}
