import { css, html, type PropertyDeclarations } from "lit";
import type { SetupEventDetail } from "./setup-events.types.js";
import { SetupPress } from "./setup-press.js";
import { SetupBaseStyles } from "./setup-styles.js";

/**
 * # Setup hit area
 * An invisible press area laid over part of a control (a set's picture and its "Cards" tab, over the tile that
 * otherwise toggles the set): a sibling of the control rather than a child, so a tap on it is not also a tap on the
 * control under it. Size and place it with CSS; `stop` is left out when it is only a second area of a control that has one.
 *
 * @element mc-setup-hit
 * @prop action - What a tap raises.
 */
export class McSetupHit extends SetupPress {
  static override styles = [
    SetupBaseStyles,
    css`
      :host {
        position: absolute;
        z-index: 1;
      }
    `,
  ];

  static override properties: PropertyDeclarations = { ...SetupPress.properties, action: { attribute: false } };

  declare action: SetupEventDetail | null;

  constructor() {
    super();
    this.action = null;
  }

  protected override act(): SetupEventDetail | null {
    return this.action;
  }

  override render() {
    return html``;
  }
}
