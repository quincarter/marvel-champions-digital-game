import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles, type PictureSource } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import type { RoleBuildCardView, RoleBuildView } from "../../../view/campaign-role-build-model.js";
import { raiseBriefing, raiseStep } from "../briefing.types.js";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import "../mc-briefing-card-thumb/mc-briefing-card-thumb.js";
import { costLineOf } from "./cost-line.js";
import { McBriefingRoleBuildListStyles } from "./mc-briefing-role-build-list.styles.js";
import type { RoleBuildListModel } from "./mc-briefing-role-build-list.types.js";

const NONE: PictureSource = { src: null };

/**
 * # Briefing role-building list
 * Role-building card list: a "Recommended for you" group (a picture, a RECOMMENDED tag, the name, a one-line reason, Inspect and
 * Take) and then every other card as a grid of pictures with name, cost and aspect, and a Take button each. A tap on a picture or
 * its name reads the card in Inspect (which offers "Take this card"); only Take opens the confirm step. Every card keeps its stops:
 * `rb-card:<id>` (the picture), `rb-take:<id>`, `rb-inspect:<id>` (recommended) and `rb-read:<id>` (a grid card name and cost).
 *
 * @element mc-briefing-role-build-list
 * @prop model - `RoleBuildListModel`.
 * @fires mc-briefing-step - `{ type: "take", id }`.
 * @fires mc-briefing - `{ type: "inspect", cardId, name, choice }`, from a picture, a name or Inspect.
 */
export class McBriefingRoleBuildList extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingRoleBuildListStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
  };

  declare model: RoleBuildListModel | null;

  constructor() {
    super();
    this.model = null;
    new BriefingRelay(this);
  }

  #card(card: RoleBuildCardView) {
    return { cardId: card.id, name: card.name, choice: { optionId: card.id, label: t("briefing.call.takeThis") } };
  }

  #take(card: RoleBuildCardView) {
    return (event: Event) => {
      event.stopPropagation();
      raiseStep(this, { type: "take", id: card.id });
    };
  }

  #recommended(card: RoleBuildCardView, pictures: ReadonlyMap<string, PictureSource>) {
    return html`<div class="rec">
      <mc-briefing-card-thumb
        class="rec-art"
        .stop=${`rb-card:${card.id}`}
        .card=${this.#card(card)}
        .picture=${pictures.get(card.id) ?? NONE}
        badge
      ></mc-briefing-card-thumb>
      <div class="rec-text">
        <span class="tag">${t("briefing.call.build.recommended").toLocaleUpperCase()}</span>
        <span class="rec-name">${card.label}</span>
        <span class="reason">${card.reason ?? ""}</span>
        <div class="rec-buttons">
          <mc-button
            kind="quiet"
            data-stop=${`rb-inspect:${card.id}`}
            .label=${t("decks.card.inspect")}
            @mc-press=${(event: Event) => {
              event.stopPropagation();
              raiseBriefing(this, { type: "inspect", ...this.#card(card) });
            }}
          ></mc-button>
          <mc-button
            kind="primary"
            data-stop=${`rb-take:${card.id}`}
            .label=${t("briefing.call.take")}
            @mc-press=${this.#take(card)}
          ></mc-button>
        </div>
      </div>
    </div>`;
  }

  #cell(card: RoleBuildCardView, pictures: ReadonlyMap<string, PictureSource>) {
    return html`<div class="cell">
      <mc-briefing-card-thumb
        class="cell-art"
        .stop=${`rb-card:${card.id}`}
        .card=${this.#card(card)}
        .picture=${pictures.get(card.id) ?? NONE}
        badge
      ></mc-briefing-card-thumb>
      <div class="read-block">
        <mc-hit-area
          class="read"
          .stop=${`rb-read:${card.id}`}
          .action=${{ type: "inspect", ...this.#card(card) }}
          .holdAction=${{ type: "inspect", ...this.#card(card) }}
        ></mc-hit-area>
        <span class="cell-name">${card.label}</span>
        <span class="cell-cost">${costLineOf(card)}</span>
      </div>
      <mc-button
        kind="secondary"
        data-stop=${`rb-take:${card.id}`}
        .label=${t("briefing.call.take")}
        @mc-press=${this.#take(card)}
      ></mc-button>
    </div>`;
  }

  /** The section label above a group: "RECOMMENDED FOR YOU", then "ALL OTHER EVENTS" (or "ALL EVENTS" with none recommended). */
  #label(view: RoleBuildView, first: boolean): string {
    if (first && view.recommended.length > 0) return t("briefing.call.build.recommendedHeading");
    const key = view.recommended.length > 0 ? "others" : "all";
    return t(`briefing.call.build.${key}_${view.noun}` as "briefing.call.build.others_event");
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const { view, pictures } = m;
    return html`${
      view.recommended.length > 0
        ? html`<span class="group-label">${this.#label(view, true).toLocaleUpperCase()}</span>
            ${view.recommended.map((card) => this.#recommended(card, pictures))}`
        : nothing
    }
    ${
      view.rest.length > 0
        ? html`<span class="group-label">${this.#label(view, false).toLocaleUpperCase()}</span>
            <div class="grid">${view.rest.map((card) => this.#cell(card, pictures))}</div>`
        : nothing
    }`;
  }
}
