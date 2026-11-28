import { html, nothing, type PropertyDeclarations } from "lit";
import "../mc-pause-keyword/mc-pause-keyword.js";
import type { PauseRulesInput } from "../pause.types.js";
import { PauseElement } from "../shared/PauseElement.js";
import { McPauseRulesStyles } from "./mc-pause-rules.styles.js";

/**
 * # Pause rules reference
 * The paper pane's top section: "Rules reference" with what it is filtered to, over a grid of keyword and status cards for
 * what is on the table right now. The grid takes the room the pane gives it and scrolls natively; on a short screen the
 * pane itself scrolls and the grid grows to its cards.
 *
 * @element mc-pause-rules
 * @prop input - The title, the filter line and the cards (`PauseRulesInput`).
 * @fires mc-pause - `{ type: "keyword", id }` on a press on a card.
 */
export class McPauseRules extends PauseElement {
  static override styles = McPauseRulesStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
  };

  declare input: PauseRulesInput | null;

  constructor() {
    super();
    this.input = null;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    return html`<header class="head">
        <h2 class="title">${input.title}</h2>
        <span class="rule"></span>
        <span class="filtered">${input.filtered}</span>
      </header>
      ${
        input.entries.length === 0
          ? html`<p class="empty">${input.empty}</p>`
          : html`<div class="grid scroller">
              ${input.entries.map((entry) => html`<mc-pause-keyword .keyword=${entry}></mc-pause-keyword>`)}
            </div>`
      }`;
  }
}
