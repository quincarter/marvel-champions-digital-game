/**
 * Makes a mode bar's buttons reachable from a pad or keyboard (the bars over the hand: Pay, Play it, a form, a
 * helper's Approve). Until now only a mouse or a finger could press them; the focus route had no stop for them.
 *
 * A bar's Cancel (or Decline, when it backs the play out) is the route's `cancel` stop; every other button is a `bar`
 * stop in draw order, with a focus ring on its rect. The bar's forward button is `primary`: Start / Menu presses it
 * (`BoardScene#pressPrimary`), and its glyph says so.
 */

import { McButton, type McButtonOptions } from "../../ui/widgets.js";
import type { BoardDrawContext } from "./context.js";
import { focusKey } from "./selection.js";

/** The bar's way out: the focus route's `cancel` stop, with its glyph (B / Esc) beside the word. */
export function addBarCancel(ctx: BoardDrawContext, options: McButtonOptions): McButton {
  const button = new McButton(ctx.scene, options);
  ctx.frame.buttons.push(button);
  ctx.frame.focusRects.set(focusKey({ kind: "cancel" }), options.rect);
  ctx.hints.button(button, ["cancel"], "paper");
  return button;
}

/**
 * Any other button on the bar: a `bar` focus stop whose press is the button's own click, and the Start glyph when it
 * is the bar's forward one (`primary`).
 */
export function addBarButton(
  ctx: BoardDrawContext,
  options: McButtonOptions,
  extra: { readonly primary?: boolean } = {},
): McButton {
  const button = new McButton(ctx.scene, options);
  ctx.frame.buttons.push(button);
  const index = ctx.frame.barStops.length;
  const enabled = options.enabled !== false;
  ctx.frame.barStops.push({
    rect: options.rect,
    press: options.onClick,
    primary: extra.primary === true,
    enabled,
  });
  ctx.frame.focusRects.set(focusKey({ kind: "bar", index }), options.rect);
  if (extra.primary === true && enabled) ctx.hints.button(button, ["confirm"], "paper");
  return button;
}
