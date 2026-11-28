import { html, nothing, type PropertyDeclarations } from "lit";
import { McPress } from "../../../shared/press/McPress.js";
import { McSwitchRowStyles } from "./mc-switch-row.styles.js";

/**
 * # Switch row
 * A settings row on an ink ground: a title over a line of detail, and at the right a switch that says its state in words
 * (ON, OFF, or a word such as Open; "—" when unavailable), never in colour alone. The whole row is the control: a tap on it
 * raises `action`. An unavailable row stays in place, dimmed, and its detail says why.
 *
 * @element mc-switch-row
 * @attr title-text - The row's title, already translated.
 * @attr detail - The line under it.
 * @attr state - The switch's word.
 * @attr on - The switch is on.
 * @attr unavailable - The row cannot be used now: dimmed, a tap does nothing.
 * @prop action - What a tap raises.
 * @fires mc-pressed - `PressDetail`.
 */
export class McSwitchRow extends McPress {
  static override styles = McSwitchRowStyles;

  static override properties: PropertyDeclarations = {
    ...McPress.properties,
    titleText: { type: String, attribute: "title-text" },
    detail: { type: String },
    state: { type: String },
    on: { type: Boolean, reflect: true },
    unavailable: { type: Boolean, reflect: true },
  };

  declare titleText: string;
  declare detail: string;
  declare state: string;
  declare on: boolean;
  declare unavailable: boolean;

  constructor() {
    super();
    this.titleText = "";
    this.detail = "";
    this.state = "";
    this.on = false;
    this.unavailable = false;
  }

  protected override tapAction(): unknown {
    return this.unavailable ? null : this.action;
  }

  override render() {
    return html`<div class="row">
      <div class="text">
        <span class="title">${this.titleText}</span>
        ${this.detail ? html`<span class="detail">${this.detail}</span>` : nothing}
      </div>
      <span class="switch">${this.state}</span>
    </div>`;
  }
}
