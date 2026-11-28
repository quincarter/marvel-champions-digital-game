import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { raiseBriefing } from "../briefing.types.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import "../mc-briefing-framed-row/mc-briefing-framed-row.js";
import "../mc-briefing-pick-card/mc-briefing-pick-card.js";
import { McBriefingSchemePickStyles } from "./mc-briefing-scheme-pick.styles.js";
import type { SchemePickModel } from "./mc-briefing-scheme-pick.types.js";

/**
 * # Briefing side-scheme pick
 * The player-side-scheme call (NeXt Evolution, MC40 p. 7): one row per offered scheme with its cards as pictures (the scheme, the
 * environment it earns, the encounter card it brings) and a PICK button that answers with the row name. A picture opens Inspect and
 * answers nothing, so reading a card can never record the choice. A wide row is one line (the pictures with their captions beside
 * them, Pick at the end); a narrow one is headed by its label ("Mission Prep → Mission Prepped") with the pictures in equal
 * cells under it.
 *
 * @element mc-briefing-scheme-pick
 * @prop model - `SchemePickModel`.
 * @fires mc-briefing - `{ type: "answer", picked: [name] }`, or an `inspect` from a picture.
 */
export class McBriefingSchemePick extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingSchemePickStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: SchemePickModel | null;

  override render() {
    const m = this.model;
    if (!m) return nothing;
    return html`<p class="prompt row-title">${t("briefing.call.scheme.prompt")}</p>
      <p class="note body">${t("briefing.call.scheme.note")}</p>
      ${m.rows.map(
        (row) => html`<mc-briefing-framed-row>
          <div class="row" style=${`--cards:${row.cards.length}`}>
            <span class="title row-title">${row.label}</span>
            <div class="cards">
              ${row.cards.map(
                (card) =>
                  html`<mc-briefing-pick-card
                    .stop=${`call-scheme:${row.name}:${card.key}`}
                    .card=${card}
                    badge
                  ></mc-briefing-pick-card>`,
              )}
            </div>
            <mc-button
              class="pick"
              kind="primary"
              data-stop=${`call-option:${row.name}`}
              .label=${t("briefing.call.pick").toLocaleUpperCase()}
              @mc-press=${(event: Event) => {
                event.stopPropagation();
                raiseBriefing(this, { type: "answer", picked: [row.name] });
              }}
            ></mc-button>
          </div>
        </mc-briefing-framed-row>`,
      )}`;
  }
}
