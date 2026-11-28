import { css, html, type PropertyDeclarations } from "lit";
import type { SetupEventDetail } from "./setup-events.types.js";
import { SetupPress } from "./setup-press.js";
import { SetupBaseStyles } from "./setup-styles.js";

/**
 * # Setup chip
 * A chip or segment: ink fill with paper words when chosen, paper with ink words otherwise (the state is the fill and the
 * words, never colour alone); dimmed and inert when it cannot be pressed (a stepper at its end). Raises `action`.
 * `link` draws it as words only ("Cards ▸").
 *
 * @element mc-setup-chip
 * @attr label - Its words, already translated.
 * @attr selected - Chosen.
 * @attr link - Words only, no box.
 * @prop action - What a tap raises.
 */
export class McSetupChip extends SetupPress {
  static override styles = [
    SetupBaseStyles,
    css`
      :host {
        min-width: 0;
        min-height: var(--chip-height, 44px);
      }
      .box {
        height: 100%;
        min-height: inherit;
        display: grid;
        place-items: center;
        padding: 0 4px;
        background: var(--mc-fill-card);
        border: 2px solid var(--mc-line-ink);
        font-family: var(--mc-font-display);
        text-transform: uppercase;
        font-size: var(--chip-size, 20px);
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      :host([selected]) .box {
        background: var(--mc-fill-ink);
        color: var(--mc-text-paper);
      }
      :host([disabled]) .box {
        opacity: 0.5;
        border-color: color-mix(in srgb, var(--mc-line-ink) 40%, transparent);
      }
      :host([link]) {
        min-height: 0;
      }
      :host([link]) .box {
        border: 0;
        background: none;
        font-family: var(--mc-font-body);
        font-size: var(--mc-small-10, 10px);
        font-weight: 700;
        letter-spacing: 0.14em;
        padding: 2px 0;
        place-items: start;
      }
    `,
  ];

  static override properties: PropertyDeclarations = {
    ...SetupPress.properties,
    label: { type: String },
    selected: { type: Boolean, reflect: true },
    link: { type: Boolean, reflect: true },
    action: { attribute: false },
  };

  declare label: string;
  declare selected: boolean;
  declare link: boolean;
  declare action: SetupEventDetail | null;

  constructor() {
    super();
    this.label = "";
    this.selected = false;
    this.link = false;
    this.action = null;
  }

  protected override act(): SetupEventDetail | null {
    return this.action;
  }

  override render() {
    return html`<div class="box">${this.label}</div>`;
  }
}
