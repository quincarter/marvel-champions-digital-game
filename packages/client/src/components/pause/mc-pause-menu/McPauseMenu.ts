import { glyphLabelShift } from "@mc/ui";
import { html, nothing, type PropertyDeclarations } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import type { PauseMenuItem, PauseMode } from "../pause.types.js";
import { PauseElement } from "../shared/PauseElement.js";
import { McPauseMenuStyles } from "./mc-pause-menu.styles.js";

/**
 * # Pause menu
 * The buttons of the ink menu column (wide) or the footer (phone): Resume, Full game log, Rules reference, Settings, Your
 * stats, Save & quit, Music, Report, and the ones a game adds (a watch link, Show my hand, Stop tutorial, Manual adjust).
 * Concede, and any other `foot` item, sits at the foot of the column when there is room and follows the rest when the
 * screen is short, so no button ever draws over another: the page scrolls the column. Each button is a focus stop named by
 * its id.
 *
 * @element mc-pause-menu
 * @prop items - The buttons (`PauseMenuItem`).
 * @attr mode - wide | phone.
 * @fires mc-pause - `{ type: "menu", id }` on a press on a button.
 */
export class McPauseMenu extends PauseElement {
  static override styles = McPauseMenuStyles;

  static override properties: PropertyDeclarations = {
    items: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare items: readonly PauseMenuItem[];
  declare mode: PauseMode;

  constructor() {
    super();
    this.items = [];
    this.mode = "wide";
  }

  #button(item: PauseMenuItem) {
    return html`<div
      class=${classMap({ item: true, full: item.span === 2, primary: item.kind === "primary" })}
      style=${styleMap({ "--mc-label-shift": `${glyphLabelShift(item.glyph)}px` })}
    >
      <mc-button
        kind=${item.kind}
        display
        ?selected=${item.selected ?? false}
        data-stop=${item.id}
        .label=${item.label}
        @mc-press=${() => this.say({ type: "menu", id: item.id })}
      ></mc-button>
      ${item.glyph ? html`<mc-glyph-hint .glyph=${item.glyph}></mc-glyph-hint>` : nothing}
    </div>`;
  }

  override render() {
    const main = this.items.filter((item) => !item.foot);
    const foot = this.items.filter((item) => item.foot);
    return html`<div class="grid">${main.map((item) => this.#button(item))}</div>
      ${foot.length > 0 ? html`<div class="grid foot">${foot.map((item) => this.#button(item))}</div>` : nothing}`;
  }
}
