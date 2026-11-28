import { ThemeStyles } from "@mc/ui";
import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { FeatureRelay } from "../../../dom/feature-relay.js";
import "../../../components/civil-war/mc-civil-foot/mc-civil-foot.js";
import "../../../components/civil-war/mc-civil-leaders/mc-civil-leaders.js";
import "../../../components/civil-war/mc-civil-rail/mc-civil-rail.js";
import "../../../components/civil-war/mc-civil-review/mc-civil-review.js";
import "../../../components/civil-war/mc-civil-sets/mc-civil-sets.js";
import "../../../components/civil-war/mc-civil-sheet/mc-civil-sheet.js";
import "../../../components/civil-war/mc-civil-sides/mc-civil-sides.js";
import "../../../components/civil-war/mc-civil-stages/mc-civil-stages.js";
import "../../../components/civil-war/mc-civil-summary/mc-civil-summary.js";
import {
  CIVIL_WAR_EVENT,
  type CivilPageModel,
  type CivilWarEventDetail,
} from "../../../components/civil-war/civil-war.types.js";
import { t } from "../../../i18n/translate.js";
import { McCivilWarPageStyles } from "./mc-civil-war-page.styles.js";

/**
 * # Civil War builder (page)
 * The builder as one element that composes sections and holds no state: the ink `mc-top-bar` (the title, the status line as
 * its subtitle, "Show me" at the end of a blind build), the step rail (a bar of numbers on a phone), the active step
 * (sides, leaders, main scheme, modular sets or review) in one natively scrolling body, on a desktop the summary in a column
 * beside it, and the sticky foot. The "cards in this set" sheet covers it while open. The scene mounts it, sets `model` and
 * hears `mc-civil-war`.
 *
 * @element mc-civil-war-page
 * @prop model - `CivilPageModel`.
 * @attr mode - wide | tablet | phone, from the model.
 * @fires mc-civil-war - Any section's `CivilWarEventDetail`; `{ type: "act", action: "civil:back" }` from the bar.
 */
export class McCivilWarPage extends LitElement {
  static override styles = [ThemeStyles, McCivilWarPageStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    mode: { type: String, reflect: true },
  };

  declare model: CivilPageModel | null;
  declare mode: "wide" | "tablet" | "phone";

  constructor() {
    super();
    this.model = null;
    this.mode = "wide";
    new FeatureRelay<CivilWarEventDetail>(this, CIVIL_WAR_EVENT);
  }

  protected override willUpdate(): void {
    this.mode = this.model?.mode ?? "wide";
  }

  /** The scrolling body: the sheet's while it is open, else the step's. */
  get scroller(): HTMLElement | null {
    return (
      this.renderRoot.querySelector<HTMLElement & { scroller: HTMLElement | null }>("mc-civil-sheet")?.scroller ??
      this.renderRoot.querySelector<HTMLElement>(".body")
    );
  }

  #say(detail: CivilWarEventDetail): void {
    this.dispatchEvent(
      new CustomEvent<CivilWarEventDetail>(CIVIL_WAR_EVENT, { detail, bubbles: true, composed: true }),
    );
  }

  #step(m: CivilPageModel) {
    const view = m.view;
    switch (view.step) {
      case 1:
        return html`<mc-civil-sides .sides=${view.sideChoices} .pictures=${m.pictures}></mc-civil-sides>`;
      case 2:
        return html`<mc-civil-leaders
          .leaders=${view.leaderChoices}
          .pictures=${m.pictures}
          expert-note=${view.expertNote ?? ""}
        ></mc-civil-leaders>`;
      case 3:
        return html`<mc-civil-stages
          .rows=${view.stageRows}
          .pictures=${m.pictures}
          summary=${view.stageSummary}
        ></mc-civil-stages>`;
      case 4:
        return html`<mc-civil-sets .modular=${view.modular} .pictures=${m.pictures} mode=${m.mode}></mc-civil-sets>`;
      default:
        return html`<mc-civil-review
          .view=${view}
          .pictures=${m.pictures}
          ?with-summary=${m.mode !== "wide"}
        ></mc-civil-review>`;
    }
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    const view = m.view;
    const phone = m.mode === "phone";
    const title = view.seal
      ? t("comp.builder.title")
      : phone
        ? `Step ${view.step} · ${view.steps[view.step - 1]!.title}`
        : view.title;
    return html`<mc-top-bar
        class="bar"
        .heading=${title}
        .subtitle=${m.status}
        .backLabel=${m.bar.backLabel}
        .backGlyph=${m.bar.backGlyph}
        ?compact=${phone}
        @mc-press=${() => this.#say({ type: "act", action: "civil:back" })}
      >
        ${
          view.blind
            ? html`<mc-hint-button
                slot="end"
                kind="onInk"
                data-stop="civil:blind:show"
                hug
                label="Show me"
                @mc-press=${(event: Event) => {
                  event.stopPropagation();
                  this.#say({ type: "act", action: "civil:blind:show" });
                }}
              ></mc-hint-button>`
            : nothing
        }
      </mc-top-bar>
      <div class="main">
        <mc-civil-rail class="rail" .steps=${view.steps} mode=${m.mode}></mc-civil-rail>
        <div class="body" data-key="builder-body"><div class="step">${this.#step(m)}</div></div>
        ${
          m.mode === "wide"
            ? html`<aside class="review">
                <mc-civil-summary .view=${view} .pictures=${m.pictures}></mc-civil-summary>
              </aside>`
            : nothing
        }
      </div>
      <mc-civil-foot
        class="foot"
        start-label=${view.seal ? t("comp.builder.seal") : "Continue to heroes ▸"}
        start-reason=${view.startProblem ?? ""}
        ?can-start=${view.canStart}
      ></mc-civil-foot>
      ${
        m.sheet
          ? html`<mc-civil-sheet
              .sheet=${m.sheet.view}
              .pictures=${m.pictures}
              set-id=${m.sheet.view.setId}
              ?picked=${m.sheet.picked}
              ?enabled=${m.sheet.enabled}
              reason=${m.sheet.reason ?? ""}
            ></mc-civil-sheet>`
          : nothing
      }`;
  }
}
