import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import type { HandledRow } from "../../../view/campaign-briefing-model.js";
import { McBriefingHandledRowStyles } from "./mc-briefing-handled-row.styles.js";

/**
 * # Briefing handled row
 * One thing setup did for the player: a green check when it happens this issue or a blue arrow for a value held for a later one
 * (never Hero Red, which is the call to action), its title, an optional detail line and the printed page it comes from at the
 * right edge. The mark is a shape as well as a colour.
 *
 * @element mc-briefing-handled-row
 * @prop row - `HandledRow`, its words already in the player language.
 */
export class McBriefingHandledRow extends LitElement {
  static override styles = [ThemeStyles, McBriefingHandledRowStyles];

  static override properties: PropertyDeclarations = {
    row: { attribute: false },
  };

  declare row: HandledRow | null;

  constructor() {
    super();
    this.row = null;
  }

  override render() {
    const row = this.row;
    if (!row) return nothing;
    return html`<span class=${row.status === "done" ? "mark done" : "mark later"}
        >${row.status === "done" ? "✓" : "→"}</span
      >
      <div class="text">
        <span class="title">${row.title}</span>
        ${row.detail.length > 0 ? html`<span class="detail">${row.detail}</span>` : nothing}
      </div>
      ${row.citation ? html`<span class="citation">${row.citation}</span>` : nothing}`;
  }
}
