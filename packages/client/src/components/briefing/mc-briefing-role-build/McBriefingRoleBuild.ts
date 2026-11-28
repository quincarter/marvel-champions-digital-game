import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";
import { ThemeStyles, type PictureSource } from "@mc/ui";
import { artLanguageNow } from "../../../art/art-source.js";
import { t } from "../../../i18n/translate.js";
import { aspectStampOf } from "../../../view/aspect-stamp.js";
import {
  backFromRoleBuild,
  confirmedRoleBuildCard,
  ROLE_BUILD_START,
  roleBuildOf,
  selectRoleBuildCard,
  setRoleBuildFilter,
  type RoleBuildState,
  type RoleBuildView,
} from "../../../view/campaign-role-build-model.js";
import type { CoreAspect } from "@mc/content";
import { raiseBriefing, type BriefingStepDetail } from "../briefing.types.js";
import { BriefingTextStyles } from "../shared/briefing.styles.js";
import "../mc-briefing-confirm-bar/mc-briefing-confirm-bar.js";
import "../mc-briefing-role-build-card/mc-briefing-role-build-card.js";
import "../mc-briefing-role-build-list/mc-briefing-role-build-list.js";
import { McBriefingRoleBuildStyles } from "./mc-briefing-role-build.styles.js";
import type { RoleBuildCallModel } from "./mc-briefing-role-build.types.js";

const NONE: PictureSource = { src: null };

/**
 * # Briefing role-building
 * Role-building (MC32 p. 5): each player may take up to 1 event and 1 upgrade from their role two aspects. The call takes the whole
 * screen under the heading and the seat header: an intro, the aspect filter chips, the card list in its own native scroller
 * (`mc-briefing-role-build-list`) and Decline pinned at the foot; a card chosen with Take (or from Inspect "Take this card") opens the
 * confirm step instead: the card (`mc-briefing-role-build-card`, scrolling on a screen too short for it) over the Back / Inspect /
 * Confirm bar pinned at the foot, so Confirm is reachable without scrolling. The engine decides what may be chosen
 * (`pending.options` already skips cards in the deck); the view model only presents it. This element owns the filter and the chosen
 * card, and starts again with every new question. Stops: `rb-chip:<aspect|all>`, `rb-card:<id>`, `call-decline`, then `rb-back`,
 * `rb-confirm`, `rb-inspect`.
 *
 * @element mc-briefing-role-build
 * @prop model - `RoleBuildCallModel`.
 * @fires mc-briefing - `{ type: "answer", picked: [id | none] }`, or an `inspect`.
 */
export class McBriefingRoleBuild extends LitElement {
  static override styles = [ThemeStyles, BriefingTextStyles, McBriefingRoleBuildStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    state: { state: true },
  };

  declare model: RoleBuildCallModel | null;
  declare state: RoleBuildState;
  /** The list scroll position held while the confirm step stands in for the list. */
  #listTop = 0;

  constructor() {
    super();
    this.model = null;
    this.state = ROLE_BUILD_START;
    this.addEventListener("mc-briefing-step", (event) => this.#step(event.detail, event));
  }

  get #view(): RoleBuildView | null {
    const m = this.model;
    return m ? roleBuildOf(m.build.cards, m.build.ctx, this.state) : null;
  }

  /** A card chosen in the Inspect sheet ("Take this card") opens its confirm step: the same as Take on the list. */
  take(id: string): void {
    const view = this.#view;
    if (view) this.#choose(view, id);
  }

  #choose(view: RoleBuildView, id: string): void {
    const list = this.renderRoot.querySelector(".list");
    if (list) this.#listTop = list.scrollTop;
    this.state = selectRoleBuildCard(this.state, view, id);
  }

  #step(detail: BriefingStepDetail, event: Event): void {
    const view = this.#view;
    if (!view) return;
    if (detail.type === "take") this.#choose(view, detail.id);
    else if (detail.type === "back") this.state = backFromRoleBuild(this.state);
    else if (detail.type === "confirm") {
      const id = confirmedRoleBuildCard(this.state, view);
      if (id !== null) raiseBriefing(this, { type: "answer", picked: [id] });
    } else if (detail.type === "read") {
      const card = view.all.find((one) => one.id === this.state.selected);
      if (card) raiseBriefing(this, { type: "inspect", cardId: card.id, name: card.name });
    } else return;
    event.stopPropagation();
  }

  #filter(aspect: CoreAspect | null): void {
    this.state = setRoleBuildFilter(this.state, aspect);
    const list = this.renderRoot.querySelector(".list");
    if (list) list.scrollTop = 0;
  }

  protected override updated(changed: PropertyValues): void {
    // Back from the confirm step returns to the same place in the list.
    if (changed.has("state") && this.state.selected === null) {
      const list = this.renderRoot.querySelector<HTMLElement>(".list");
      if (list && this.#listTop > 0) list.scrollTop = this.#listTop;
    }
  }

  #chips(view: RoleBuildView) {
    const lang = artLanguageNow();
    return html`<div class="chips">
      ${view.chips.map((chip) => {
        const stamp = chip.aspect ? aspectStampOf(chip.aspect, lang) : null;
        const word = stamp ? stamp.label : t("briefing.call.build.all");
        const hex = (value: number): string => `#${value.toString(16).padStart(6, "0")}`;
        return html`<mc-chip
          .stop=${`rb-chip:${chip.aspect ?? "all"}`}
          .label=${`${chip.selected ? "✓ " : ""}${word.toLocaleUpperCase()} ${chip.count}`}
          ?selected=${chip.selected}
          .action=${{ type: "filter", aspect: chip.aspect }}
          style=${stamp ? `--chip-fill:${hex(stamp.fill)};--chip-color:${hex(stamp.ink)}` : ""}
          @mc-pressed=${(event: CustomEvent) => {
            event.stopPropagation();
            this.#filter(chip.aspect);
          }}
        ></mc-chip>`;
      })}
    </div>`;
  }

  override render() {
    const m = this.model;
    const view = this.#view;
    if (!m || !view) return nothing;
    const selected = view.all.find((card) => card.id === this.state.selected);
    if (selected) {
      return html`<div class="confirm-scroll scroller">
          <mc-briefing-role-build-card
            .model=${{
              card: selected,
              picture: m.pictures.get(selected.id) ?? NONE,
              heroName: m.build.ctx.heroName,
              noun: view.noun,
              phone: m.phone,
            }}
          ></mc-briefing-role-build-card>
        </div>
        <mc-briefing-confirm-bar
          class="bar"
          .model=${{ stops: { back: "rb-back", confirm: "rb-confirm", read: "rb-inspect" }, glyph: m.confirmGlyph }}
        ></mc-briefing-confirm-bar>`;
    }
    const lang = artLanguageNow();
    const aspects = m.build.ctx.roleAspects.map((aspect) => aspectStampOf(aspect, lang).label).join(" + ");
    return html`<p class="intro body">
        ${t(`briefing.call.build.intro_${view.noun}`, { role: m.build.ctx.roleName, aspects })}
      </p>
      ${this.#chips(view)}
      ${
        view.rest.length + view.recommended.length === 0
          ? html`<span class="none label">${t(`briefing.call.build.none_${view.noun}`)}</span>`
          : html`<div class="list scroller">
              <mc-briefing-role-build-list .model=${{ view, pictures: m.pictures }}></mc-briefing-role-build-list>
            </div>`
      }
      <mc-button
        class="decline"
        kind="secondary"
        data-stop="call-decline"
        .label=${t(`briefing.call.build.decline_${view.noun}`)}
        @mc-press=${(event: Event) => {
          event.stopPropagation();
          raiseBriefing(this, { type: "answer", picked: [] });
        }}
      ></mc-button>`;
  }
}
