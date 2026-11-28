import { html, LitElement, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { pressOf } from "../scenario-select.types.js";
import { McScenarioChipsStyles } from "./mc-scenario-chips.styles.js";
import type { ScenarioChip } from "./mc-scenario-chips.types.js";

/**
 * # Scenario chips
 * The product chips of Choose a scenario: one `mc-filter-chip` per pack, as wide as its words, wrapped over as many rows
 * as it takes (a wide screen) or one row that scrolls sideways (`rail`: a phone or a tablet). A chosen chip leads with a
 * check, so the state never rests on color alone. Each chip is a focus stop, `scenario-chip:<id>`.
 *
 * @element mc-scenario-chips
 * @prop chips - `ScenarioChip[]`, in order.
 * @attr rail - One sideways row instead of wrapped rows.
 * @fires mc-scenario-select - `{ type: "press", key: "scenario-chip:<id>" }`.
 */
export class McScenarioChips extends LitElement {
  static override styles = [ThemeStyles, McScenarioChipsStyles];

  static override properties: PropertyDeclarations = {
    chips: { attribute: false },
    rail: { type: Boolean, reflect: true },
  };

  declare chips: readonly ScenarioChip[];
  declare rail: boolean;

  constructor() {
    super();
    this.chips = [];
    this.rail = false;
  }

  /** The chip element for a stop key, so a focus on it can scroll it into view along the rail. */
  elementOf(id: string): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
  }

  override render() {
    return html`<div class="chips" role="group">
      ${repeat(
        this.chips,
        (chip) => chip.id,
        (chip) =>
          html`<mc-filter-chip
            data-id=${chip.id}
            data-stop=${`scenario-chip:${chip.id}`}
            .label=${chip.label}
            .value=${chip.id}
            hug
            ?selected=${chip.selected}
            @mc-activate=${pressOf(this, `scenario-chip:${chip.id}`)}
          ></mc-filter-chip>`,
      )}
    </div>`;
  }
}
