import { css, html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import type { OptionChip, SetupOptionRow } from "../../../view/setup-options.js";
import { CardFrameStyles, SetupBaseStyles } from "./setup-styles.js";

/**
 * # Setup option card
 * One setup option the scenario offers (Gene Pool threat, the Horsemen's sides, easier start, Heroic level, Skirmish, a
 * villain pick): a framed card with its name (and a line under it) and its controls: the whole card for a toggle, a
 * stepper's two buttons around its value, or chips in one or several labeled groups. Every control is the option's own
 * action string; the card decides nothing.
 *
 * @element mc-setup-option-card
 * @prop row - The option (`SetupOptionRow`).
 * @attr compact - The phone's stacked arrangement (name over its controls).
 * @fires mc-setup - `{ type: "option", action }` for a chip, a stepper button or a toggle.
 */
export class McSetupOptionCard extends LitElement {
  static override styles = [
    SetupBaseStyles,
    CardFrameStyles,
    css`
      .frame {
        padding: 8px 10px;
        display: flex;
        gap: 10px;
        align-items: center;
        min-height: 60px;
      }
      :host([compact]) .frame {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
      }
      .names {
        flex: 0 0 var(--names, 170px);
        max-width: 40%;
        min-width: 0;
      }
      :host([compact]) .names {
        flex: none;
        max-width: none;
      }
      .name {
        --name-size: 18px;
      }
      .off .name,
      .off .value {
        opacity: 0.6;
      }
      .controls {
        flex: 1;
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        align-items: center;
        min-width: 0;
      }
      :host([compact]) .controls {
        justify-content: flex-start;
      }
      .controls mc-setup-chip {
        flex: 1 1 0;
        max-width: 84px;
      }
      :host([compact]) .controls mc-setup-chip {
        max-width: 120px;
      }
      .step mc-setup-chip {
        flex: 0 0 48px;
      }
      .value {
        font-family: var(--mc-font-display);
        font-size: 20px;
        min-width: 56px;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .wide-value .value {
        flex: 1;
      }
      .groups {
        display: grid;
        grid-template-columns: repeat(var(--per-row, 4), minmax(0, 1fr));
        gap: 6px 12px;
        flex: 1;
      }
      .group .label {
        margin-bottom: 2px;
      }
      .pair {
        display: flex;
        gap: 4px;
      }
      .pair mc-setup-chip {
        flex: 1;
      }
      mc-setup-card {
        display: block;
      }
    `,
  ];

  static override properties: PropertyDeclarations = {
    row: { attribute: false },
    compact: { type: Boolean, reflect: true },
  };

  declare row: SetupOptionRow | null;
  declare compact: boolean;

  constructor() {
    super();
    this.row = null;
    this.compact = false;
  }

  #chip(chip: OptionChip) {
    return html`<mc-setup-chip
      stop=${ifDefined(chip.enabled ? `option:${chip.action}` : undefined)}
      label=${chip.label}
      ?selected=${chip.selected}
      ?disabled=${!chip.enabled}
      .action=${{ type: "option", action: chip.action } as const}
    ></mc-setup-chip>`;
  }

  override render() {
    const row = this.row;
    if (!row) return nothing;
    const control = row.control;
    if (control.kind === "toggle") {
      return html`<mc-setup-card
        stop=${`option:${control.action}`}
        ?selected=${row.active}
        .action=${{ type: "option", action: control.action } as const}
      >
        <div class="name" style="--name-size:18px">${row.name}</div>
        <div class="meta">${row.meta}</div>
      </mc-setup-card>`;
    }
    const names = html`<div class="names">
      <div class="name">${row.name}</div>
      ${row.meta && !this.compact ? html`<div class="meta">${row.meta}</div>` : nothing}
    </div>`;
    const dim = row.active ? "" : "off";
    if (control.kind === "stepper") {
      return html`<div class="frame ${row.active ? "selected" : ""} ${dim} ${control.wide ? "wide-value" : ""}">
        ${names}
        <div class="controls step">
          ${this.#chip(control.down)}<span class="value">${control.valueLabel}</span>${this.#chip(control.up)}
        </div>
      </div>`;
    }
    const groups = control.groups;
    return html`<div class="frame ${row.active ? "selected" : ""} ${dim}">
      ${names}
      ${groups.length === 1
        ? html`<div class="controls">${groups[0]!.chips.map((chip) => this.#chip(chip))}</div>`
        : html`<div class="groups" style=${`--per-row:${this.compact ? 2 : groups.length}`}>
            ${groups.map(
              (group) => html`<div class="group">
                <div class="label">${group.label ?? ""}</div>
                <div class="pair">${group.chips.map((chip) => this.#chip(chip))}</div>
              </div>`,
            )}
          </div>`}
    </div>`;
  }
}
