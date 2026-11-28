import { html } from "lit";
import { McPress } from "../../../shared/press/McPress.js";
import { McHitAreaStyles } from "./mc-hit-area.styles.js";

/**
 * # Hit area
 * An invisible press area laid over part of a control (a set's picture and its "Cards" tab, over the tile that
 * otherwise toggles the set): a sibling of the control rather than a child, so a tap on it is not also a tap on the
 * control under it. Size and place it with CSS; `stop` is left out when it is only a second area of a control that has
 * one.
 *
 * @element mc-hit-area
 * @prop action - What a tap raises.
 * @fires mc-pressed - `PressDetail`.
 */
export class McHitArea extends McPress {
  static override styles = [McHitAreaStyles];

  override render() {
    return html``;
  }
}
