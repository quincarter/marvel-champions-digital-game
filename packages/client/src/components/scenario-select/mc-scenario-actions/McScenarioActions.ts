import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { pressOf } from "../scenario-select.types.js";
import { McScenarioActionsStyles } from "./mc-scenario-actions.styles.js";
import type { ScenarioActionsModel } from "./mc-scenario-actions.types.js";

/**
 * # Scenario actions
 * The foot of the screen: "Customize this scenario" when the scenario can be customized, the red "Choose heroes" call to
 * action and a small caption under it. On a wide screen it sits at the foot of the ink panel (`ground="ink"`, paper
 * words); on a narrow one it is on the page's own ground. Focus stops `customize` and `next`; `next` stays a stop while
 * dimmed (it says why in its tooltip), as the pad route's primary only goes forward when it can.
 *
 * @element mc-scenario-actions
 * @prop model - `ScenarioActionsModel`.
 * @attr ground - `ink` (the wide side panel) or `paper`.
 * @fires mc-scenario-select - `{ type: "press", key: "customize" | "next" }`.
 */
export class McScenarioActions extends LitElement {
  static override styles = [ThemeStyles, McScenarioActionsStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    ground: { type: String, reflect: true },
  };

  declare model: ScenarioActionsModel | null;
  declare ground: "ink" | "paper";

  constructor() {
    super();
    this.model = null;
    this.ground = "paper";
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`
      ${
        m.customize
          ? html`<mc-button
              class="customize"
              data-stop="customize"
              kind=${this.ground === "ink" ? "onInk" : "secondary"}
              plain
              .label=${m.customize}
              @mc-press=${pressOf(this, "customize")}
            ></mc-button>`
          : nothing
      }
      <mc-hint-button
        class="next"
        data-stop="next"
        kind="primary"
        display
        ?disabled=${m.nextDisabled !== null}
        .reason=${m.nextDisabled ?? ""}
        .label=${m.next}
        .glyph=${m.nextGlyph}
        @mc-press=${pressOf(this, "next")}
      ></mc-hint-button>
      <p class=${m.captionIsLock ? "caption lock" : "caption"}>${m.caption}</p>
    `;
  }
}
