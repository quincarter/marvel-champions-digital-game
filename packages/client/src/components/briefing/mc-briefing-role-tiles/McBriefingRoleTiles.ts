import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { raiseStep } from "../briefing.types.js";
import "../mc-briefing-option-tile/mc-briefing-option-tile.js";
import { McBriefingRoleTilesStyles } from "./mc-briefing-role-tiles.styles.js";
import type { RoleTilesModel } from "./mc-briefing-role-tiles.types.js";

/**
 * # Briefing role tiles
 * The role call (MC32 p. 5, "Campaign roles"): four explainer tiles (name, aspect chips, a plain-words summary, how the role sits
 * against the seat deck, or who already took it) and the "What roles do" note. A tap selects a role and the call opens its confirm
 * step; what is legal is the engine offer, and a role an earlier seat holds is shown, spelled out, and cannot be picked.
 *
 * @element mc-briefing-role-tiles
 * @prop model - `RoleTilesModel`.
 * @fires mc-briefing-step - `{ type: "role", id }`.
 */
export class McBriefingRoleTiles extends LitElement {
  static override styles = [ThemeStyles, McBriefingRoleTilesStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: RoleTilesModel | null;

  constructor() {
    super();
    this.model = null;
    this.addEventListener("mc-pressed", (event) => {
      const action = event.detail.action as { type?: string; id?: string } | null;
      if (action?.type !== "role" || action.id === undefined) return;
      event.stopPropagation();
      raiseStep(this, { type: "role", id: action.id });
    });
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<div class="tiles">
        ${m.tiles.map((tile) => html`<mc-briefing-option-tile .tile=${tile}></mc-briefing-option-tile>`)}
      </div>
      <div class="note">
        <span class="note-heading">${m.note.heading.toLocaleUpperCase()}</span>
        ${m.note.lines.map((line) => html`<span class="note-line">${line}</span>`)}
      </div>`;
  }
}
