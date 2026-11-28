import { css, html, type PropertyDeclarations } from "lit";
import type { SetupEventDetail } from "./setup-events.types.js";
import { SetupPress } from "./setup-press.js";
import { CardFrameStyles, SetupBaseStyles } from "./setup-styles.js";

/**
 * # Setup card
 * A framed white card that is itself a control (a difficulty, Tower Defense's toggle, a modular set): a thin outline, or a
 * 4px red border when chosen. Its content is slotted; a tap raises `action`, a hold raises `inspect` where it has one.
 *
 * @element mc-setup-card
 * @attr selected - Chosen: the red border.
 * @attr dim - Unavailable: faded.
 * @prop action - What a tap raises.
 * @prop inspect - What a hold or Inspect raises, or none.
 * @slot - The card's content.
 */
export class McSetupCard extends SetupPress {
  static override styles = [
    SetupBaseStyles,
    CardFrameStyles,
    css`
      :host {
        min-width: 0;
      }
      .frame {
        height: 100%;
        padding: 8px 10px;
      }
    `,
  ];

  static override properties: PropertyDeclarations = {
    ...SetupPress.properties,
    selected: { type: Boolean, reflect: true },
    dim: { type: Boolean, reflect: true },
    action: { attribute: false },
    inspectAction: { attribute: false },
  };

  declare selected: boolean;
  declare dim: boolean;
  declare action: SetupEventDetail | null;
  declare inspectAction: SetupEventDetail | null;

  constructor() {
    super();
    this.selected = false;
    this.dim = false;
    this.action = null;
    this.inspectAction = null;
  }

  protected override act(): SetupEventDetail | null {
    return this.action;
  }

  protected override hold(): SetupEventDetail | null {
    return this.inspectAction;
  }

  override render() {
    return html`<div class="frame"><div class="inner"><slot></slot></div></div>`;
  }
}
