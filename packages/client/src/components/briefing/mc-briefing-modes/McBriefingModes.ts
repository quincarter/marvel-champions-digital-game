import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import type { IssueModeRow } from "../../../view/campaign-modes-model.js";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import { McBriefingModesStyles } from "./mc-briefing-modes.styles.js";
import { modeRowTextIn } from "./modes-text.js";

/**
 * # Briefing modes
 * The Briefing mode section (`view/campaign-modes-model.ts`): a heading and one row per mode, its name and line of state over
 * full-size chips (ink when chosen, the state in words as well as in colour). A chip the model disables is shown and takes no
 * press; a press raises `set-mode` with the chip action, and the scene stores the mode and composes the issue again.
 *
 * @element mc-briefing-modes
 * @prop rows - `IssueModeRow[]`.
 * @fires mc-briefing - `{ type: "set-mode", action }`.
 */
export class McBriefingModes extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingModesStyles];

  static override properties: PropertyDeclarations = {
    rows: { attribute: false },
  };

  declare rows: readonly IssueModeRow[];

  constructor() {
    super();
    this.rows = [];
    new BriefingRelay(this);
  }

  override render() {
    if (this.rows.length === 0) return nothing;
    return html`<mc-section-heading .label=${t("briefing.modes.heading").toLocaleUpperCase()}></mc-section-heading>
      ${this.rows.map((row) => {
        const text = modeRowTextIn(row);
        return html`<div class="mode">
          <div class="head">
            <span class="name display">${text.name}</span>
            <span class="meta">${text.meta}</span>
          </div>
          <div class="chips">
            ${text.chips.map((chip, index) => {
              const live = chip.enabled && chip.action !== "";
              return html`<mc-chip
                .stop=${live ? `mode:${chip.action}` : ""}
                .label=${chip.text}
                .action=${live ? { type: "set-mode", action: chip.action } : null}
                ?selected=${chip.selected}
                ?disabled=${!live && !chip.selected ? true : false}
                data-index=${index}
              ></mc-chip>`;
            })}
          </div>
        </div>`;
      })}`;
  }
}
