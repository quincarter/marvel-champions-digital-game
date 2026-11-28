import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type McShelfRoster } from "@mc/ui";
import { raiseScenarioSelect } from "../scenario-select.types.js";
import "../mc-scenario-random-row/mc-scenario-random-row.js";
import { McScenarioShelvesStyles } from "./mc-scenario-shelves.styles.js";
import type { ScenarioShelvesModel } from "./mc-scenario-shelves.types.js";

type KeyDetail = { readonly key: string };

/**
 * # Scenario shelves
 * The scenario list: the Random row over an `mc-shelf-roster` (one shelf per pack, each a row that scrolls sideways, the
 * whole stack scrolling down; or a box opened as a grid). The roster's taps and holds are re-raised as the screen's own
 * `mc-scenario-select`, so the scene hears one event. The tiles are focus stops `scenario:<id>`, the fold headers
 * `scenario-shelf:<id>`, the empty state's button `scenario-clear`, all marked by the roster.
 *
 * @element mc-scenario-shelves
 * @prop model - `ScenarioShelvesModel`.
 * @fires mc-scenario-select - `tile` (a tile, a fold header, See all, Clear) and `inspect` (a hold or right-click).
 */
export class McScenarioShelves extends LitElement {
  static override styles = [ThemeStyles, McScenarioShelvesStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: ScenarioShelvesModel | null;

  constructor() {
    super();
    this.model = null;
  }

  /** The roster, for its scroller, its rows and the scroll position a visit to Take your seats and back puts back. */
  get roster(): McShelfRoster | null {
    return this.renderRoot.querySelector<McShelfRoster>("mc-shelf-roster");
  }

  #forward(type: "tile" | "inspect") {
    return (event: CustomEvent<KeyDetail>): void => {
      event.stopPropagation();
      raiseScenarioSelect(this, { type, key: event.detail.key });
    };
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`
      <mc-scenario-random-row .model=${m.randomRow}></mc-scenario-random-row>
      <mc-shelf-roster
        .model=${m.roster}
        @mc-activate=${this.#forward("tile")}
        @mc-inspect=${this.#forward("inspect")}
      ></mc-shelf-roster>
    `;
  }
}
