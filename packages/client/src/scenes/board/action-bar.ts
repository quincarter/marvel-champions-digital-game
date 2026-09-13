/**
 * The action bar: the four basic actions, End turn, and the advisory line.
 */

import { appSession } from "../../session.js";
import { hit, signal, status, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { McButton } from "../../ui/widgets.js";
import type { BoardModel } from "../../view/board-model.js";
import type { BasicAction } from "../../view/highlights.js";
import type { Rect } from "../../view/layout.js";
import type { BoardDrawContext } from "./context.js";
import { basicKindOf, focusKey } from "./selection.js";

const BASICS: readonly BasicAction[] = ["attack", "thwart", "recover", "changeForm"];

/**
 * The action bar, parked at the thumb.
 *
 * Phone stacks it the way the design canvas does — a 44px abilities row over
 * a 52px commit row — because five controls side by side at 375px are five
 * controls nobody can hit. Wider layouts keep them on one line with End turn
 * at the right.
 */
export function drawActionBar(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const { scene, controller, marks } = ctx;
  const selection = controller.selection;
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);

  const stacked = rect.height >= hit.target + hit.primary;
  const labels: Record<BasicAction, string> = {
    attack: "Attack",
    thwart: "Thwart",
    recover: "Recover",
    // "Flip to alter-ego" does not fit a quarter of a phone; the short form
    // still says which way the flip goes.
    changeForm: stacked ? (model.myForm === "hero" ? "To A-E" : "To hero") : model.myForm === "hero" ? "Flip to alter-ego" : "Flip to hero",
    endTurn: "End turn",
  };

  const endTurnWidth = stacked ? rect.width - 20 : Math.min(180, rect.width * 0.28);
  const basicsWidth = stacked ? rect.width - 20 : rect.width - endTurnWidth - 30;
  const cellWidth = (basicsWidth - (BASICS.length - 1) * 6) / BASICS.length;

  BASICS.forEach((action, index) => {
    const button = marks?.basics.find((basic) => basic.action === action);
    const targeting = selection.kind === "targeting" && basicKindOf(selection.action) === action;
    const cell: Rect = { x: rect.x + 10 + index * (cellWidth + 6), y: rect.y + 4, width: cellWidth, height: hit.target - 8 };
    ctx.frame.focusRects.set(focusKey({ kind: "basic", action }), cell);
    // A status owns the button it cancels (Components.dc.html section 05):
    // stunned hatches Attack, confused hatches Thwart, in that status's hue.
    // Still pressable when the engine allows it — attacking while stunned is a
    // legal play that spends the stun, and sometimes the right one.
    const cancelledBy =
      (action === "attack" || action === "thwart") && model.me.disabledActions.includes(action)
        ? status[action === "attack" ? "stunned" : "confused"]
        : null;
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "onInk",
        label: cancelledBy ? `${labels[action]} ✕` : labels[action],
        type: typeRole.label,
        rect: cell,
        enabled: button?.enabled ?? false,
        selected: targeting,
        ...(cancelledBy ? { hatch: cancelledBy.hex } : {}),
        ...(button?.reason ? { reason: button.reason } : {}),
        onClick: () => controller.chooseBasic(action),
      }),
    );
  });

  // The one red fill in the bar: the forward action of the table.
  const endTurn = marks?.basics.find((basic) => basic.action === "endTurn");
  const endTurnRect: Rect = stacked
    ? { x: rect.x + 10, y: rect.y + hit.target, width: endTurnWidth, height: hit.primary - 6 }
    : { x: rect.x + rect.width - endTurnWidth - 10, y: rect.y + 4, width: endTurnWidth, height: hit.primary - 10 };
  ctx.frame.focusRects.set(focusKey({ kind: "basic", action: "endTurn" }), endTurnRect);
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "primary",
      label: "End turn",
      type: typeRole.barTitle,
      rect: endTurnRect,
      enabled: endTurn?.enabled ?? false,
      ...(endTurn?.reason ? { reason: endTurn.reason } : {}),
      onClick: () => void controller.dispatchExample("endTurn"),
    }),
  );

  // The advisory line: a prompt while targeting, otherwise the engine's last
  // rejection. Caution yellow, never red — red is the action, not the alarm.
  const message =
    selection.kind === "targeting"
      ? selection.prompt
      : selection.kind === "paying"
        ? "" // The payment bar above the hand is already saying it.
        : (appSession().store.state.error ?? "");
  if (message && !stacked) {
    scene.add
      .text(rect.x + 10, rect.y + rect.height - 14, message, textStyle(typeRole.body, signal.caution.hex))
      .setOrigin(0, 0.5)
      .setMaxLines(1);
  }
}
