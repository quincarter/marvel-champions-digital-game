import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ThemeStyles } from "@mc/ui";
import { t } from "../../../i18n/translate.js";
import { raiseBriefing } from "../briefing.types.js";
import { BriefingRelay } from "../shared/BriefingRelay.js";
import "../mc-briefing-card-thumb/mc-briefing-card-thumb.js";
import { McBriefingOptionsStyles } from "./mc-briefing-options.styles.js";
import type { OptionsModel } from "./mc-briefing-options.types.js";

/**
 * # Briefing options
 * A plain pick of options (single or multi): one button per option in a wrapped grid, each option beside its card picture when every
 * option is a card (the picture opens Inspect and answers nothing; the option own button takes it). A single pick answers on the
 * press; a multi pick toggles and Confirm (enabled once exactly `count` are chosen) submits them. An optional pick adds Decline. A
 * random draw is "Take it" and Decline. The list is as long as it is: the page scrolls, there are no pages. Stop keys:
 * `call-option:<index>`, `call-inspect:<index>`, `call-confirm`, `call-decline`, `call-accept`.
 *
 * @element mc-briefing-options
 * @prop model - `OptionsModel`.
 * @fires mc-briefing - `{ type: "answer", picked }`, or an `inspect` from a card picture.
 */
export class McBriefingOptions extends LitElement {
  static override styles = [ThemeStyles, McBriefingOptionsStyles];

  static override properties: PropertyDeclarations = {
    model: { attribute: false },
    picking: { state: true },
  };

  declare model: OptionsModel | null;
  /** The multi pick own selections before Confirm submits them. */
  declare picking: readonly string[];

  constructor() {
    super();
    this.model = null;
    this.picking = [];
    new BriefingRelay(this);
  }

  #answer(picked: readonly string[]): void {
    raiseBriefing(this, { type: "answer", picked });
  }

  #stop = (event: Event): void => event.stopPropagation();

  #toggle(id: string): void {
    const m = this.model;
    if (!m) return;
    if (m.count <= 1) return this.#answer([id]);
    this.picking = this.picking.includes(id) ? this.picking.filter((one) => one !== id) : [...this.picking, id];
  }

  #decline() {
    return html`<mc-button
      class="decline"
      kind=${this.model?.random ? "secondary" : "quiet"}
      data-stop="call-decline"
      .label=${t("prompt.decline")}
      @mc-press=${(event: Event) => {
        this.#stop(event);
        this.#answer([]);
      }}
    ></mc-button>`;
  }

  override render() {
    const m = this.model;
    if (!m) return nothing;
    if (m.random) {
      return html`<div class="pair">
        ${this.#decline()}
        <mc-button
          class="accept"
          kind="primary"
          data-stop="call-accept"
          .label=${t("briefing.call.accept")}
          @mc-press=${(event: Event) => {
            this.#stop(event);
            this.#answer([m.acceptValue]);
          }}
        ></mc-button>
      </div>`;
    }
    const ready = this.picking.length === m.count;
    return html`<div class=${m.options.some((option) => option.card) ? "grid cards" : "grid"}>
        ${m.options.map((option, index) => {
          const button = html`<mc-button
            kind="secondary"
            wrap
            data-stop=${`call-option:${index}`}
            ?selected=${this.picking.includes(option.id)}
            .label=${option.label}
            @mc-press=${(event: Event) => {
              this.#stop(event);
              this.#toggle(option.id);
            }}
          ></mc-button>`;
          return option.card
            ? html`<div class="cell">
                <mc-briefing-card-thumb
                  .stop=${`call-inspect:${index}`}
                  .card=${{ cardId: option.card.cardId, name: option.card.name }}
                  .picture=${option.card.picture}
                  shape=${option.card.shape}
                  badge
                ></mc-briefing-card-thumb>
                ${button}
              </div>`
            : button;
        })}
      </div>
      ${
        m.count > 1
          ? html`<mc-hint-button
              class="confirm"
              kind="primary"
              data-stop=${ready ? "call-confirm" : nothing}
              ?disabled=${!ready}
              .label=${t("briefing.call.confirm")}
              .glyph=${ready ? m.confirmGlyph : null}
              @mc-press=${(event: Event) => {
                this.#stop(event);
                if (ready) this.#answer(this.picking);
              }}
            ></mc-hint-button>`
          : nothing
      }
      ${m.optional ? this.#decline() : nothing}`;
  }
}
