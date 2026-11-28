import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import type { ModularSetCallView, ModularSetTile } from "../../../view/campaign-modular-call-model.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import "../mc-briefing-option-tile/mc-briefing-option-tile.js";
import type { OptionTileModel } from "../mc-briefing-option-tile/mc-briefing-option-tile.types.js";
import { McBriefingModularStyles } from "./mc-briefing-modular.styles.js";

/** A set tile as the shared tile takes it: picking it answers with the set id; a chosen set wears the stripe and its words. */
export function modularTileModel(tile: ModularSetTile): OptionTileModel {
  const footerTone = tile.status === "chosen" ? "heal" : tile.status === "reusable" ? "cost" : "red";
  return {
    stop: `call-option:${tile.id}`,
    action: { type: "answer", picked: [tile.id] },
    title: tile.name,
    body: tile.detail,
    ...(tile.statusLabel ? { footer: tile.statusLabel, footerTone } : {}),
    available: tile.available,
    ...(tile.status === "chosen" ? { stripe: true } : {}),
  } as const;
}

/**
 * # Briefing modular-set call
 * The modular-set call: the question, its one-line explanation, one tile per set and the two lines under them (the checked-off rule,
 * "what is a genre set"). A set already chosen wears a heal-green stripe and its words; one checked off is dimmed and says so in words
 * as well as tone. Plain drawing over `ModularSetCallView` (`view/campaign-modular-call-model.ts`), its sentences already in the
 * player language (`modularViewIn`). A tile press answers with the set id.
 *
 * @element mc-briefing-modular
 * @prop view - `ModularSetCallView`.
 * @fires mc-briefing - `{ type: "answer", picked: [setId] }`.
 */
export class McBriefingModular extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingModularStyles];

  static override properties: PropertyDeclarations = {
    view: { attribute: false },
  };

  declare view: ModularSetCallView | null;

  constructor() {
    super();
    this.view = null;
  }

  override render() {
    const view = this.view;
    if (!view) return nothing;
    return html`<p class="question row-title">${view.question}</p>
      <p class="explain body">${view.explain}</p>
      <div class="tiles">
        ${view.tiles.map((tile) => html`<mc-briefing-option-tile .tile=${modularTileModel(tile)}></mc-briefing-option-tile>`)}
      </div>
      <div class="lines body">
        ${view.rule !== null ? html`<p>${view.rule}</p>` : nothing}
        <p>${view.whatIs}</p>
      </div>`;
  }
}
