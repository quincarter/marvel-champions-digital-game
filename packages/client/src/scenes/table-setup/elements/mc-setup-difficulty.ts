import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { t } from "../../../i18n/translate.js";
import { difficultySetLine } from "../../../view/difficulty-sets.js";
import { lt } from "../text/lt.js";
import type { SetupOptionRow } from "../../../view/setup-options.js";
import type { DifficultyInput } from "../difficulty/difficulty.types.js";
import type { SetupMode } from "./setup-events.types.js";
import { CardFrameStyles, SetupBaseStyles } from "./setup-styles.js";

/**
 * # Setup difficulty section
 * The Difficulty section of Set up the table: the difficulty cards (a segment strip on a phone), the Standard / Expert set
 * choices folded into the row's spare slot, the setup-option cards under it and Tower Defense's toggle. It draws what its
 * `input` says; everything the player does is raised as `mc-setup` events by the elements it is made of.
 *
 * @element mc-setup-difficulty
 * @prop input - What it shows (`DifficultyInput`).
 * @attr mode - wide | tablet | phone.
 * @attr slots - How many equal slots the difficulty row has (the cards, and the sets card when there is one).
 * @attr inline-sets - The sets card sits in the row's spare slot, its names beside their chips.
 */
export class McSetupDifficulty extends LitElement {
  static override styles = [
    SetupBaseStyles,
    CardFrameStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(var(--slots, 3), minmax(0, 1fr));
        gap: 12px;
      }
      .cards mc-setup-card {
        min-height: 76px;
      }
      .cards .name {
        --name-size: 18px;
      }
      .cards .meta {
        margin-top: 4px;
        opacity: 0.8;
      }
      .strip {
        display: flex;
        gap: 2px;
      }
      .strip mc-setup-chip {
        flex: 1;
        --chip-size: 17px;
      }
      .sets {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .setrow {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .setrow .who {
        flex: 0 0 96px;
        min-width: 0;
      }
      .setrow .name {
        --name-size: 16px;
      }
      .chips {
        flex: 1;
        display: flex;
        gap: 6px;
        justify-content: flex-end;
      }
      .chips mc-setup-chip {
        flex: 1 1 0;
        max-width: 80px;
      }
      .opts {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 12px;
      }
      .opts > .span2 {
        grid-column: 1 / -1;
      }
      :host([mode="phone"]) .opts {
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .tdmeta {
        margin-top: 4px;
        opacity: 0.8;
      }
    `,
  ];

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
    slots: { type: Number },
    inlineSets: { type: Boolean, attribute: "inline-sets" },
    onink: { type: Boolean },
  };

  declare input: DifficultyInput | null;
  declare mode: SetupMode;
  declare slots: number;
  declare inlineSets: boolean;
  /** The ground is ink (tablet in portrait): the heading is drawn in paper. */
  declare onink: boolean;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
    this.slots = 3;
    this.inlineSets = true;
    this.onink = false;
  }

  #setsCard(rows: readonly SetupOptionRow[]) {
    return html`<div class="frame sets ${rows.some((r) => r.active) ? "selected" : ""}">
      ${rows.map((row, index) => {
        if (row.control.kind !== "groups") return nothing;
        return html`<div class="setrow">
          <div class="who">
            <div class="name">${row.name}</div>
            ${index === 0
              ? html`<mc-setup-chip link stop="sets-cards" label=${t("tableSetup.cards")} .action=${{ type: "sets-sheet" } as const}></mc-setup-chip>`
              : nothing}
          </div>
          <div class="chips">
            ${row.control.groups[0]!.chips.map(
              (chip) => html`<mc-setup-chip
                stop=${`option:${chip.action}`}
                label=${chip.label}
                ?selected=${chip.selected}
                .action=${{ type: "option", action: chip.action } as const}
              ></mc-setup-chip>`,
            )}
          </div>
        </div>`;
      })}
      ${rows.length === 1 ? html`<div class="label">${lt(difficultySetLine(rows[0]!))}</div>` : nothing}
    </div>`;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const phone = this.mode === "phone";
    const td = input.towerDefense;
    const tdMeta = t(td.on ? "tableSetup.td.on" : "tableSetup.td.off", { n: td.perHero });
    return html`
      <mc-setup-heading label=${t("tableSetup.difficulty")} ?onink=${this.onink}></mc-setup-heading>
      ${phone
        ? html`<div class="strip">
            ${input.cards.map(
              (card) => html`<mc-setup-chip
                stop=${`difficulty:${card.id}`}
                label=${card.name}
                ?selected=${input.selected === card.id}
                .action=${{ type: "difficulty", id: card.id } as const}
              ></mc-setup-chip>`,
            )}
          </div>`
        : html`<div class="cards" style=${`--slots:${this.slots}`}>
            ${input.cards.map(
              (card) => html`<mc-setup-card
                stop=${`difficulty:${card.id}`}
                ?selected=${input.selected === card.id}
                .action=${{ type: "difficulty", id: card.id } as const}
              >
                <div class="name">${card.name}</div>
                <div class="meta">${card.description}</div>
              </mc-setup-card>`,
            )}
            ${input.setChoices.length > 0 ? this.#setsCard(input.setChoices) : nothing}
          </div>`}
      ${phone && input.setChoices.length > 0 ? this.#setsCard(input.setChoices) : nothing}
      <div class="opts">
        ${input.optionRows.map(
          (row) => html`<mc-setup-option-card class=${row.span === 2 ? "span2" : ""} .row=${row} ?compact=${phone}></mc-setup-option-card>`,
        )}
        ${td.offered && !phone
          ? html`<mc-setup-card class="span2" stop="towerDefenseSetupDamage" ?selected=${td.on} .action=${{ type: "tower-defense" } as const}>
              <div class="name" style="--name-size:18px">${t("tableSetup.td.name")}</div>
              <div class="tdmeta">${tdMeta}</div>
            </mc-setup-card>`
          : nothing}
        ${td.offered && phone
          ? html`<mc-setup-check-row
              stop="towerDefenseSetupDamage"
              name=${t("tableSetup.td.name")}
              meta=${tdMeta}
              ?checked=${td.on}
              .action=${{ type: "tower-defense" } as const}
            ></mc-setup-check-row>`
          : nothing}
      </div>
    `;
  }
}
