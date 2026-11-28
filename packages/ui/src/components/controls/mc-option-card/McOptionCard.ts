import { html, LitElement, nothing, type PropertyDeclarations } from "lit";
import { McOptionCardStyles } from "./mc-option-card.styles.js";
import type { McOptionChip, McOptionRow } from "./mc-option-card.types.js";

/**
 * # Option card
 * One option the owner offers (a threat count, a pair of sides, a level, a villain pick): a framed card with its name (and
 * a line under it) and its controls: the whole card for a toggle, a stepper's two buttons around its value, or chips in
 * one or several labeled groups. Every control raises `mc-pressed` with the option's own action string; the card
 * decides nothing. The focus stop of a control is `<stop-prefix><action>`.
 *
 * Its own pieces (`mc-chip`, `mc-press-card`) are defined by the ui entry.
 *
 * @element mc-option-card
 * @prop row - The option (`McOptionRow`).
 * @attr compact - The phone's stacked arrangement (name over its controls).
 * @attr stop-prefix - What a control's stop key starts with (`option:`).
 * @fires mc-pressed - `PressDetail` whose `action` is the option's action string.
 */
export class McOptionCard extends LitElement {
  static override styles = [McOptionCardStyles];

  static override properties: PropertyDeclarations = {
    row: { attribute: false },
    compact: { type: Boolean, reflect: true },
    stopPrefix: { type: String, attribute: "stop-prefix" },
  };

  declare row: McOptionRow | null;
  declare compact: boolean;
  declare stopPrefix: string;

  constructor() {
    super();
    this.row = null;
    this.compact = false;
    this.stopPrefix = "option:";
  }

  #chip(chip: McOptionChip) {
    return html`<mc-chip
      .stop=${chip.enabled ? `${this.stopPrefix}${chip.action}` : ""}
      label=${chip.label}
      ?selected=${chip.selected}
      ?disabled=${!chip.enabled}
      .action=${chip.action}
    ></mc-chip>`;
  }

  override render() {
    const row = this.row;
    if (!row) return nothing;
    const control = row.control;
    if (control.kind === "toggle") {
      return html`<mc-press-card
        .stop=${`${this.stopPrefix}${control.action}`}
        ?selected=${row.active}
        .action=${control.action}
      >
        <div class="name big">${row.name}</div>
        <div class="meta">${row.meta}</div>
      </mc-press-card>`;
    }
    const names = html`<div class="names">
      <div class="name">${row.name}</div>
      ${row.meta && !this.compact ? html`<div class="meta">${row.meta}</div>` : nothing}
    </div>`;
    const state = `${row.active ? "selected" : ""} ${row.active ? "" : "off"}`;
    if (control.kind === "stepper") {
      return html`<div class="frame ${state} ${control.wide ? "wide-value" : ""}">
        ${names}
        <div class="controls step">
          ${this.#chip(control.down)}<span class="value">${control.valueLabel}</span>${this.#chip(control.up)}
        </div>
      </div>`;
    }
    const groups = control.groups;
    return html`<div class="frame ${state}">
      ${names}
      ${
        groups.length === 1
          ? html`<div class="controls">${groups[0]!.chips.map((chip) => this.#chip(chip))}</div>`
          : html`<div class="groups" style=${`--per-row:${this.compact ? 2 : groups.length}`}>
              ${groups.map(
                (group) =>
                  html`<div class="group">
                    <div class="label">${group.label ?? ""}</div>
                    <div class="pair">${group.chips.map((chip) => this.#chip(chip))}</div>
                  </div>`,
              )}
            </div>`
      }
    </div>`;
  }
}
