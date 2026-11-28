import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { t } from "../../../i18n/translate.js";
import { difficultySetLine } from "../../../view/difficulty-sets.js";
import type { SetupOptionRow } from "../../../view/setup-options.js";
import { lt } from "../../../scenes/table-setup/text/lt.js";
import type { SetupMode } from "../shared/setup-events.types.js";
import { SetupRelay } from "../shared/setup-relay.js";
import type { DifficultyInput } from "./mc-setup-difficulty.types.js";
import { McSetupDifficultyStyles } from "./mc-setup-difficulty.styles.js";

/**
 * # Setup difficulty section
 * The Difficulty section of Set up the table: the difficulty cards (a segment strip on a phone), the Standard / Expert set
 * choices folded into the row's spare slot, the setup-option cards under it and Tower Defense's toggle. It draws what its
 * `input` says; everything the player does is raised as `mc-setup` events (`difficulty`, `option`, `sets-sheet`,
 * `tower-defense`) by the controls it is made of.
 *
 * @element mc-setup-difficulty
 * @prop input - What it shows (`DifficultyInput`).
 * @attr mode - wide | phone.
 * @attr onink - The ground is ink: the heading is drawn in paper.
 * @fires mc-setup - `SetupEventDetail`.
 */
export class McSetupDifficulty extends LitElement {
  static override styles = McSetupDifficultyStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
    onink: { type: Boolean },
  };

  declare input: DifficultyInput | null;
  declare mode: SetupMode;
  declare onink: boolean;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
    this.onink = false;
    new SetupRelay(this);
  }

  #setsCard(rows: readonly SetupOptionRow[]) {
    return html`<div class="sets ${rows.some((r) => r.active) ? "active" : ""}">
      ${rows.map((row, index) => {
        if (row.control.kind !== "groups") return nothing;
        return html`<div class="setrow">
          <div class="who">
            <div class="name">${row.name}</div>
            ${
              index === 0
                ? html`<mc-chip
                    link
                    label=${t("tableSetup.cards")}
                    .action=${{ type: "sets-sheet" } as const}
                  ></mc-chip>`
                : nothing
            }
          </div>
          <div class="chips">
            ${row.control.groups[0]!.chips.map(
              (chip) =>
                html`<mc-chip
                  .stop=${`option:${chip.action}`}
                  label=${chip.label}
                  ?selected=${chip.selected}
                  .action=${chip.action}
                ></mc-chip>`,
            )}
          </div>
        </div>`;
      })}
      ${rows.length === 1 ? html`<div class="label">${lt(difficultySetLine(rows[0]!))}</div>` : nothing}
    </div>`;
  }

  #cards(input: DifficultyInput) {
    const slots = Math.max(3, input.cards.length + (input.setChoices.length > 0 ? 1 : 0));
    return html`<div class="cards" style=${`--slots:${slots}`}>
      ${input.cards.map(
        (card) =>
          html`<mc-press-card
            .stop=${`difficulty:${card.id}`}
            ?selected=${input.selected === card.id}
            .action=${{ type: "difficulty", id: card.id } as const}
          >
            <div class="name">${card.name}</div>
            <div class="meta">${card.description}</div>
          </mc-press-card>`,
      )}
      ${input.setChoices.length > 0 ? this.#setsCard(input.setChoices) : nothing}
    </div>`;
  }

  #strip(input: DifficultyInput) {
    return html`<div class="strip">
      ${input.cards.map(
        (card) =>
          html`<mc-chip
            .stop=${`difficulty:${card.id}`}
            label=${card.name}
            ?selected=${input.selected === card.id}
            .action=${{ type: "difficulty", id: card.id } as const}
          ></mc-chip>`,
      )}
    </div>`;
  }

  #towerDefense(input: DifficultyInput, phone: boolean) {
    const td = input.towerDefense;
    if (!td.offered) return nothing;
    const meta = t(td.on ? "tableSetup.td.on" : "tableSetup.td.off", { n: td.perHero });
    const action = { type: "tower-defense" } as const;
    return phone
      ? html`<mc-check-row
          .stop=${"towerDefenseSetupDamage"}
          name=${t("tableSetup.td.name")}
          meta=${meta}
          ?checked=${td.on}
          .action=${action}
        ></mc-check-row>`
      : html`<mc-press-card class="span2" .stop=${"towerDefenseSetupDamage"} ?selected=${td.on} .action=${action}>
          <div class="name">${t("tableSetup.td.name")}</div>
          <div class="meta tdmeta">${meta}</div>
        </mc-press-card>`;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const phone = this.mode === "phone";
    return html`
      <mc-section-heading label=${t("tableSetup.difficulty")} ?onink=${this.onink}></mc-section-heading>
      ${phone ? this.#strip(input) : this.#cards(input)}
      ${phone && input.setChoices.length > 0 ? this.#setsCard(input.setChoices) : nothing}
      <div class="opts">
        ${input.optionRows.map(
          (row) => html`<mc-option-card class=${row.span === 2 ? "span2" : ""} .row=${row}></mc-option-card>`,
        )}
        ${this.#towerDefense(input, phone)}
      </div>
    `;
  }
}
