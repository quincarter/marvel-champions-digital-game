import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import "../mc-briefing-option-tile/mc-briefing-option-tile.js";
import { McBriefingEasierStartStyles } from "./mc-briefing-easier-start.styles.js";

/**
 * # Briefing easier start
 * The Briefing easier-start toggle (Age of Apocalypse issue #3, `view/campaign-easier-start-model.ts`) as the setup screen option
 * card: one framed card that is the whole button, the 4px red frame while on, its name and one short line of state (off is a
 * choice, not a dead control: full-strength frame and text, the state in words). The model decides where it applies; this only
 * shows it and reports the press. Focus stop `easier-start`.
 *
 * @element mc-briefing-easier-start
 * @attr on - The toggle is on.
 * @fires mc-briefing - `{ type: "toggle-easier" }`.
 */
export class McBriefingEasierStart extends LitElement {
  static override styles = [ThemeStyles, McBriefingEasierStartStyles];

  static override properties: PropertyDeclarations = {
    on: { type: Boolean, reflect: true },
  };

  declare on: boolean;

  constructor() {
    super();
    this.on = false;
  }

  override render() {
    return html`<mc-section-heading .label=${t("briefing.easier.heading").toLocaleUpperCase()}></mc-section-heading>
      <mc-briefing-option-tile
        .tile=${{
          stop: "easier-start",
          action: { type: "toggle-easier" },
          title: t("briefing.easier.name"),
          body: t(this.on ? "briefing.easier.on" : "briefing.easier.off"),
          available: true,
          on: this.on,
        }}
      ></mc-briefing-option-tile>${nothing}`;
  }
}
