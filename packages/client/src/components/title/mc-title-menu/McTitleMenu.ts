import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { TitleMenuInput } from "./mc-title-menu.types.js";
import { McTitleMenuStyles } from "./mc-title-menu.styles.js";

/**
 * # Title menu
 * The Title menu: Continue, the in-progress games row, New game, Decks, Campaign, Play online, Extras, Past games, Trophy
 * Room, Your stats, How to play, Mod Store, Settings and Quit, as rows of `mc-title-menu-button`. The page decides which
 * rows exist; this lays them out in two columns and owns no state.
 *
 * @element mc-title-menu
 * @prop input - The rows (`TitleMenuInput`).
 * @fires mc-press - From a row button, keyed by its `data-stop`.
 */
export class McTitleMenu extends LitElement {
  static override styles = McTitleMenuStyles;

  static override properties: PropertyDeclarations = { input: { attribute: false } };

  declare input: TitleMenuInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`${repeat(
      input.rows,
      (row) => row.key,
      (row) => html`<mc-title-menu-button data-key=${row.key} width=${row.width} .row=${row}></mc-title-menu-button>`,
    )}`;
  }
}
