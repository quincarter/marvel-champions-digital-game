import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { raiseStep } from "../briefing.types.js";
import { McBriefingConfirmBarStyles } from "./mc-briefing-confirm-bar.styles.js";
import type { ConfirmBarModel } from "./mc-briefing-confirm-bar.types.js";

/**
 * # Briefing confirm bar
 * The Back / Confirm bar under a confirm step (the role, a role-building card): only Confirm records the answer, Back returns to
 * the choice. An optional quiet Inspect button sits with them (in the same row on a narrow bar, under them on a wide one). Confirm
 * is the screen forward button, so it carries the pad Start glyph and its stop is one of the page forward stops.
 *
 * @element mc-briefing-confirm-bar
 * @prop model - `ConfirmBarModel`.
 * @fires mc-briefing-step - `{ type: "back" }`, `{ type: "confirm" }` or `{ type: "read" }`, for the call that owns the step.
 */
export class McBriefingConfirmBar extends LitElement {
  static override styles = [ThemeStyles, McBriefingConfirmBarStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: ConfirmBarModel | null;

  constructor() {
    super();
    this.model = null;
  }

  readonly #step = (type: "back" | "confirm" | "read") => (event: Event) => {
    event.stopPropagation();
    raiseStep(this, { type });
  };

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const read = m.stops.read;
    return html`<mc-button class="back" kind="secondary" data-stop=${m.stops.back} .label=${t("common.back")} @mc-press=${this.#step("back")}></mc-button>
      ${
        read
          ? html`<mc-button class="read" kind="quiet" data-stop=${read} .label=${t("decks.card.inspect")} @mc-press=${this.#step("read")}></mc-button>`
          : nothing
      }
      <mc-hint-button
        class="confirm"
        kind="primary"
        data-stop=${m.stops.confirm}
        .label=${t("briefing.call.confirm")}
        .glyph=${m.glyph}
        @mc-press=${this.#step("confirm")}
      ></mc-hint-button>`;
  }
}
