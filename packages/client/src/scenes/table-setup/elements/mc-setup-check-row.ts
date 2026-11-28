import { css, html, type PropertyDeclarations } from "lit";
import type { SetupEventDetail } from "./setup-events.types.js";
import { SetupPress } from "./setup-press.js";
import { SetupBaseStyles } from "./setup-styles.js";

/**
 * # Setup check row
 * The phone's checkbox row (a candidate modular set, a Hood set, Tower Defense's toggle, the watch toggle): a paper card
 * with a ticked box when on (the tick and the words say the state, never colour alone), the name over a line of detail,
 * and an optional picture at the end (slotted, with its own press for "Cards"). `locked` is the scenario's own required
 * set: ink-filled, a red ticked box, no press.
 *
 * @element mc-setup-check-row
 * @attr name - The row's name, already translated.
 * @attr meta - The line under it.
 * @attr checked - Ticked.
 * @attr locked - Required: ink fill, never pressable.
 * @prop action - What a tap raises.
 * @prop inspectAction - What a hold raises.
 * @slot end - A picture at the row's end.
 */
export class McSetupCheckRow extends SetupPress {
  static override styles = [
    SetupBaseStyles,
    css`
      :host {
        min-height: 60px;
      }
      .row {
        height: 100%;
        min-height: 60px;
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 0 10px 0 11px;
        background: var(--mc-fill-card);
        border: 2.5px solid var(--mc-line-ink);
      }
      :host([locked]) .row {
        background: var(--mc-fill-ink);
        color: var(--mc-text-paper);
      }
      .box {
        flex: none;
        width: 24px;
        height: 24px;
        border: 2px solid currentColor;
        display: grid;
        place-items: center;
        font-size: 13px;
        font-weight: 700;
      }
      :host([checked]) .box {
        background: var(--mc-fill-ink);
        color: var(--mc-text-paper);
        border-color: var(--mc-line-ink);
      }
      :host([locked]) .box {
        background: var(--mc-fill-red);
        border-color: var(--mc-text-paper);
        color: var(--mc-text-paper);
      }
      .text {
        flex: 1;
        min-width: 0;
      }
      .name {
        --name-size: 13px;
      }
      .text .label {
        margin-top: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      :host([locked]) .label {
        opacity: 0.8;
      }
    `,
  ];

  static override properties: PropertyDeclarations = {
    ...SetupPress.properties,
    name: { type: String },
    meta: { type: String },
    checked: { type: Boolean, reflect: true },
    locked: { type: Boolean, reflect: true },
    action: { attribute: false },
    inspectAction: { attribute: false },
  };

  declare name: string;
  declare meta: string;
  declare checked: boolean;
  declare locked: boolean;
  declare action: SetupEventDetail | null;
  declare inspectAction: SetupEventDetail | null;

  constructor() {
    super();
    this.name = "";
    this.meta = "";
    this.checked = false;
    this.locked = false;
    this.action = null;
    this.inspectAction = null;
  }

  protected override act(): SetupEventDetail | null {
    return this.locked ? null : this.action;
  }

  protected override hold(): SetupEventDetail | null {
    return this.inspectAction;
  }

  override render() {
    return html`<div class="row">
      <span class="box" aria-hidden="true">${this.checked || this.locked ? "✓" : ""}</span>
      <div class="text">
        <div class="name">${this.name}</div>
        <div class="label">${this.meta}</div>
      </div>
      <slot name="end"></slot>
    </div>`;
  }
}
