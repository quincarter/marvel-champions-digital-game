import { html, LitElement, nothing, type PropertyDeclarations, type TemplateResult } from "lit";
import { t, tPlural } from "../../../i18n/translate.js";
import { lt } from "../../../scenes/table-setup/text/lt.js";
import { EDIT_SCENARIO_ID, SUMMARY_SECTION_TITLE } from "../../../view/civil-war-table-summary.js";
import type { HoodModularSetOption } from "../../../view/hood-modular-sets.js";
import {
  groupStartsOpen,
  modularCardLabel,
  modularGroupsOf,
  modularSectionsFor,
  requiredCardLabel,
  type ModularGroupSummary,
  type ModularSetOption,
} from "../../../view/modular-sets.js";
import type { SetupMode } from "../shared/setup-events.types.js";
import { SetupRelay } from "../shared/setup-relay.js";
import type { SetTileInput } from "../mc-setup-set-tile/mc-setup-set-tile.types.js";
import type { ModularsInput } from "./mc-setup-modulars.types.js";
import { McSetupModularsStyles } from "./mc-setup-modulars.styles.js";

/** The header right label that no longer fits beside Random on a phone drops under the heading. */
const STACK_FROM = 26;

/**
 * # Setup modular sets section
 * The Modular sets section: the header with its Random draw, the picker (the scenario's required set(s), then every
 * candidate under its group's label; a Civil War build's read-only summary in its place) and The Hood's own set-aside
 * sets. Wide: a grid of set tiles. Phone: a list where each labeled group is a Show / Hide row. It draws what `input` says;
 * the tiles (`mc-setup-set-tile`) and controls raise `mc-setup` events (`modular-toggle`, `modular-cards`,
 * `modular-random`, `hood-toggle`, `edit-scenario`, `group-toggle`).
 *
 * @element mc-setup-modulars
 * @prop input - What it shows (`ModularsInput`).
 * @attr mode - wide | phone.
 * @attr onink - The ground is ink: headings are drawn in paper.
 * @fires mc-setup - `SetupEventDetail`.
 */
export class McSetupModulars extends LitElement {
  static override styles = McSetupModularsStyles;

  static override properties: PropertyDeclarations = {
    input: { attribute: false },
    mode: { type: String, reflect: true },
    onink: { type: Boolean },
  };

  declare input: ModularsInput | null;
  declare mode: SetupMode;
  declare onink: boolean;

  constructor() {
    super();
    this.input = null;
    this.mode = "wide";
    this.onink = false;
    new SetupRelay(this);
  }

  #tileOf(input: ModularsInput, option: ModularSetOption): SetTileInput {
    const barred = option.disabledReason !== null;
    return {
      id: option.id,
      name: option.name,
      label: lt(modularCardLabel(option)),
      selected: option.selected,
      barred,
      dim: barred && !option.selected,
      picture: option.kind === "random" ? null : (input.pictures.get(option.id) ?? null),
    };
  }

  #tile(input: ModularsInput, option: ModularSetOption) {
    return html`<mc-setup-set-tile .tile=${this.#tileOf(input, option)} .mode=${this.mode}></mc-setup-set-tile>`;
  }

  #requiredWide(input: ModularsInput) {
    return input.required.map(
      (set) => html`<div class="required">
        <div class="name">${set.name}</div>
        <div class="label">${lt(requiredCardLabel(input.villainName, set.cardCount))}</div>
      </div>`,
    );
  }

  #requiredPhone(input: ModularsInput) {
    return input.required.map(
      (set) => html`<mc-check-row
        locked
        name=${set.name}
        meta=${t("tableSetup.requiredBy", { villain: input.villainName })}
      ></mc-check-row>`,
    );
  }

  /** A Civil War build's summary lines and its "Edit scenario" control, in place of the picker. */
  #summary(input: ModularsInput, phone: boolean) {
    const cw = input.cw!;
    const edit = { type: "edit-scenario" } as const;
    const stop = `modular:${EDIT_SCENARIO_ID}`;
    const rows = cw.rows.map((row) =>
      phone
        ? html`<mc-check-row name=${row.label} meta=${row.value} locked></mc-check-row>`
        : html`<div class="info">
            <div class="name">${row.label}</div>
            <div class="label">${row.value}</div>
          </div>`,
    );
    const control = phone
      ? html`<mc-press-card .stop=${stop} .action=${edit}><div class="name">${cw.editLabel}</div></mc-press-card>`
      : html`<mc-press-card .stop=${stop} selected .action=${edit}>
          <div class="name">${cw.editLabel}</div>
        </mc-press-card>`;
    return html`<div class=${phone ? "list" : "grid"}>${rows}${control}</div>`;
  }

  /** The wide picker: required tiles, then each labeled group's tiles under its label with the group's count. */
  #grid(input: ModularsInput) {
    const out: TemplateResult[] = [];
    let next = 0;
    for (const section of modularSectionsFor(input.required.length, input.options)) {
      if (section.id === "required") {
        next += section.itemCount;
        continue;
      }
      if (section.label) out.push(html`<div class="label group-label">${section.label}</div>`);
      for (const option of input.options.slice(next - input.required.length, next - input.required.length + section.itemCount))
        out.push(this.#tile(input, option));
      next += section.itemCount;
    }
    return html`<div class="grid">${this.#requiredWide(input)}${out}</div>`;
  }

  /** The phone's picker: the locked required rows, then a Show / Hide row per labeled group and its tiles while it is open. */
  #list(input: ModularsInput) {
    const groups = new Map(modularGroupsOf(input.options).map((group) => [group.id, group]));
    const open = (group: ModularGroupSummary): boolean => input.openGroups.get(group.id) ?? groupStartsOpen(group);
    const rows: TemplateResult[] = [];
    const announced = new Set<string>();
    for (const option of input.options) {
      const group = groups.get(option.groupId);
      if (group && !announced.has(group.id)) {
        announced.add(group.id);
        rows.push(this.#groupRow(group, open(group)));
      }
      if (!group || open(group)) rows.push(this.#tile(input, option));
    }
    return html`<div class="list">${this.#requiredPhone(input)}${rows}</div>`;
  }

  #groupRow(group: ModularGroupSummary, open: boolean) {
    const chosen = group.selectedCount > 0 ? t("tableSetup.chosen", { n: group.selectedCount }) : "";
    return html`<mc-press-card
      .stop=${`modulargroup:${group.id}`}
      .action=${{ type: "group-toggle", id: group.id, open: !open } as const}
    >
      <div class="group-row">
        <span class="label">${group.label} · ${tPlural("tableSetup.sets", group.count)}${chosen}</span>
        <span class="label">${t(open ? "tableSetup.hide" : "tableSetup.show")}</span>
      </div>
    </mc-press-card>`;
  }

  #hoodTile(option: HoodModularSetOption) {
    const label = option.included
      ? t("tableSetup.hoodIn", {
          label: lt(modularCardLabel({ selected: true, cardCount: option.cardCount, descriptor: option.descriptor })),
        })
      : t("tableSetup.hoodAside", { cards: tPlural("tableSetup.cardsN", option.cardCount) });
    const action = { type: "hood-toggle", id: option.id } as const;
    return this.mode === "phone"
      ? html`<mc-check-row .stop=${`hoodSet:${option.id}`} name=${option.name} meta=${label} ?checked=${option.included} .action=${action}></mc-check-row>`
      : html`<mc-press-card class="hood-tile" .stop=${`hoodSet:${option.id}`} ?selected=${option.included} .action=${action}>
          <div class="name">${option.name}</div>
          <div class="label">${label}</div>
        </mc-press-card>`;
  }

  #hood(input: ModularsInput, phone: boolean) {
    if (input.hood.length === 0) return nothing;
    const included = input.hood.filter((option) => option.included).length;
    const right = phone
      ? t("tableSetup.hoodChoose")
      : t("tableSetup.hoodCount", { included, total: input.hood.length });
    return html`<div class="hood">
      <mc-section-heading label=${t("tableSetup.hoodTitle")} right=${right} ?onink=${this.onink}></mc-section-heading>
      <div class=${phone ? "list" : "grid"}>${input.hood.map((option) => this.#hoodTile(option))}</div>
    </div>`;
  }

  override render() {
    const input = this.input;
    if (!input) return nothing;
    const phone = this.mode === "phone";
    return html`
      <mc-section-heading
        label=${input.cw ? SUMMARY_SECTION_TITLE : t("tableSetup.modular")}
        right=${input.right}
        ?stacked=${phone && input.right.length > STACK_FROM}
        ?onink=${this.onink}
      >
        ${input.randomSets
          ? html`<mc-chip
              .stop=${"modular:random-draw"}
              label=${t("tableSetup.random")}
              .action=${{ type: "modular-random" } as const}
            ></mc-chip>`
          : nothing}
      </mc-section-heading>
      ${input.cw ? this.#summary(input, phone) : phone ? this.#list(input) : this.#grid(input)} ${this.#hood(input, phone)}
    `;
  }
}
