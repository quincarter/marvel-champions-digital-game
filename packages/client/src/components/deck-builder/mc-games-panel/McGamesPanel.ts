import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import "../mc-games-section/mc-games-section.js";
import "../mc-games-against/mc-games-against.js";
import { McGamesPanelStyles } from "./mc-games-panel.styles.js";
import type { GamesPanelModel } from "./mc-games-panel.types.js";

/**
 * # Games panel
 * "From your games" (issue #529, C2): the headline and one insight, the cards to cut and to try, the Against block, what won
 * and lost against the villain, and the staples to keep. Where the wide rail has the room it scrolls inside its own space;
 * in the narrow layout it is a tab of its own. Pure composition: its parts raise the events.
 *
 * @element mc-games-panel
 * @prop model - The panel (`GamesPanelModel`).
 * @attr on-dark - On the ink panel: the headline is the caution yellow.
 */
export class McGamesPanel extends LitElement {
  static override styles = [ThemeStyles, McGamesPanelStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    onDark: { type: Boolean, attribute: "on-dark", reflect: true },
  };

  declare model: GamesPanelModel | null;
  declare onDark: boolean;

  constructor() {
    super();
    this.model = null;
    this.onDark = false;
  }

  override render() {
    const model = this.model;
    if (!model) return nothing;
    if (model.reading !== null) return html`<div class="reading" data-key="games-reading">${model.reading}</div>`;
    return html`${model.headline ? html`<div class="headline">${model.headline}</div>` : nothing}
    ${model.insight ? html`<div class="insight">${model.insight}</div>` : nothing}
    ${model.first.map((section) => html`<mc-games-section .model=${section}></mc-games-section>`)}
    ${model.against ? html`<mc-games-against .model=${model.against}></mc-games-against>` : nothing}
    ${model.then.map((section) => html`<mc-games-section .model=${section}></mc-games-section>`)}
    ${model.nothing ? html`<div class="note">${model.nothing}</div>` : nothing}
    ${model.note ? html`<div class="note">${model.note}</div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mc-games-panel": McGamesPanel;
  }
}
