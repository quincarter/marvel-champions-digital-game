import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { t } from "../../../i18n/translate.js";
import type { CompositionRow } from "../../../view/table-setup-preview.js";
import type { SetupMode } from "../shared/setup-events.types.js";
import type { EncounterInput } from "./mc-setup-encounter.types.js";
import { McSetupEncounterStyles } from "./mc-setup-encounter.styles.js";

/**
 * # Setup encounter deck section
 * The encounter deck section ("the encounter deck you're building"): Composition (the obligations row in red), What's in
 * there and the parchment nemesis panel side by side when wide; one bordered panel on a phone. Read-only: it draws
 * `EncounterInput` and raises no events. The panels take the height their rows need; the page scrolls.
 *
 * @element mc-setup-encounter
 * @prop input - What it shows (`EncounterInput`).
 * @attr mode - wide | phone.
 * @attr onink - The ground is ink: the heading is drawn in paper.
 */
export class McSetupEncounter extends LitElement {
  static override styles = McSetupEncounterStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
    onink: { type: Boolean },
  };

  declare input: EncounterInput | null;
  declare mode: SetupMode;
  declare onink: boolean;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
    this.onink = false;
  }

  /** One count row: its label (red for obligations) at the left, the number at the right. */
  #rows(rows: readonly CompositionRow[]) {
    return rows.map(
      (row) =>
        html`<div class="row ${row.red ? "red" : ""}">
          <span class="row-label">${row.label}</span><span class="count">${row.shown ?? String(row.count)}</span>
        </div>`,
    );
  }

  #panel(title: string, rows: readonly CompositionRow[]) {
    return html`<div class="panel">
      <div class="label title">${title}</div>
      ${this.#rows(rows)}
    </div>`;
  }

  #nemesis(input: EncounterInput) {
    const nemesis = input.nemesis;
    return html`<div class="panel nemesis">
      <div class="label title">${t("tableSetup.nemesisHeld")}</div>
      ${
        nemesis
          ? html`<div class="sentence">${nemesis.sentence}</div>
              <div class="label foot">${t("tableSetup.standby", { n: nemesis.totalCards })}</div>`
          : html`<div class="sentence quiet">${t("tableSetup.nemesisNone")}</div>`
      }
    </div>`;
  }

  #phone(input: EncounterInput) {
    const both = input.composition.length > 0 && input.whatsInThere.length > 0;
    return html`<div class="panel">
      ${this.#rows(input.composition)}${both ? html`<hr />` : nothing}${this.#rows(input.whatsInThere)}
      ${
        input.nemesis
          ? html`<div class="label foot">${t("tableSetup.standby", { n: input.nemesis.totalCards })}</div>`
          : nothing
      }
    </div>`;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const phone = this.mode === "phone";
    return html`<mc-section-heading
        label=${t(phone ? "tableSetup.encounterShort" : "tableSetup.encounter")}
        right=${phone ? "" : t("tableSetup.encounterCount", { n: input.deckSize })}
        ?onink=${this.onink}
      ></mc-section-heading>
      ${
        phone
          ? this.#phone(input)
          : html`<div class="panels">
              ${this.#panel(t("tableSetup.composition"), input.composition)}
              ${this.#panel(t("tableSetup.whatsInThere"), input.whatsInThere)} ${this.#nemesis(input)}
            </div>`
      }`;
  }
}
