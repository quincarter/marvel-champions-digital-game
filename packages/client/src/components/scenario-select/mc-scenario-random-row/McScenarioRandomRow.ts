import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { ThemeStyles } from "@mc/ui";
import { pressOf } from "../scenario-select.types.js";
import { McScenarioRandomRowStyles } from "./mc-scenario-random-row.styles.js";
import type { ScenarioRandomRowModel } from "./mc-scenario-random-row.types.js";

/**
 * # Scenario random row
 * The strip above the shelves: "Random box" and "Random scenario" on the full list; drilled into a box, "◂ All packs",
 * the box's name and "Random villain". Each button is a focus stop (`drill-back`, `random-box`, `random-scenario`,
 * `random-villain`) and a press.
 *
 * @element mc-scenario-random-row
 * @prop model - `ScenarioRandomRowModel`.
 * @fires mc-scenario-select - `{ type: "press", key }`.
 */
export class McScenarioRandomRow extends LitElement {
  static override styles = [ThemeStyles, McScenarioRandomRowStyles];

  static override properties: PropertyDeclarations = { model: { attribute: false } };

  declare model: ScenarioRandomRowModel | null;

  constructor() {
    super();
    this.model = null;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`
      ${
        m.drillBack
          ? html`<mc-button
                class="back"
                data-stop="drill-back"
                kind="quiet"
                plain
                .label=${m.drillBack}
                @mc-press=${pressOf(this, "drill-back")}
              ></mc-button>
              <span class="title">${m.title}</span>`
          : nothing
      }
      ${repeat(
        m.buttons,
        (button) => button.id,
        (button) =>
          html`<mc-button
            class="random"
            data-stop=${button.id}
            kind="secondary"
            .label=${button.label}
            @mc-press=${pressOf(this, button.id)}
          ></mc-button>`,
      )}
    `;
  }
}
