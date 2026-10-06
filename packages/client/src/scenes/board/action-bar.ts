/**
 * The action bar: the four basic actions, End turn, and the advisory line.
 */

import { appSession } from "../../session.js";
import { hit, signal, status, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { McButton } from "../../ui/widgets.js";
import type { BoardModel } from "../../view/board-model.js";
import { changeFormLabel } from "../../view/change-form-label.js";
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

  // Acting for a seat whose turn it is not (an Action, RRG "Player Turn" pp. 34-35): the bar says whose cards these
  // are and offers the way back; the basic powers and End turn are the active player's alone, so they are not drawn.
  if (appSession().store.state.offTurnSeat !== null) {
    const back: Rect = { x: rect.x + rect.width - 100, y: rect.y + 4, width: 90, height: hit.target - 8 };
    scene.add
      .text(
        rect.x + 10,
        rect.y + hit.target / 2,
        `${model.me.name} · off turn`,
        textStyle(typeRole.barTitle, signal.caution.hex),
      )
      .setOrigin(0, 0.5)
      .setMaxLines(1);
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "onInk",
        label: "Back",
        type: typeRole.label,
        rect: back,
        onClick: () => appSession().store.leaveOffTurnSeat(),
      }),
    );
    return;
  }

  const stacked = rect.height >= hit.target + hit.primary;
  // Spectrum's energy/density/mass forms, Ant-Man/Wasp's Giant form: more than one destination is legal, so the
  // button can no longer say *which* way the flip goes — it opens the "Which form?" picker instead
  // (`view/change-form-choice.ts`, `controller-bar.ts`'s own `drawFormBar`).
  const formSources = controller.formSourcesFor();
  const labels: Record<BasicAction, string> = {
    attack: "Attack",
    thwart: "Thwart",
    recover: "Recover",
    changeForm: formSources.length > 1 ? "Change form" : changeFormLabel(model.myForm, stacked),
    endTurn: "End turn",
  };

  const endTurnWidth = stacked ? rect.width - 20 : Math.min(180, rect.width * 0.28);
  const basicsWidth = stacked ? rect.width - 20 : rect.width - endTurnWidth - 30;
  const cellWidth = (basicsWidth - (BASICS.length - 1) * 6) / BASICS.length;

  BASICS.forEach((action, index) => {
    const button = marks?.basics.find((basic) => basic.action === action);
    const targeting = selection.kind === "targeting" && basicKindOf(selection.action) === action;
    const cell: Rect = {
      x: rect.x + 10 + index * (cellWidth + 6),
      y: rect.y + 4,
      width: cellWidth,
      height: hit.target - 8,
    };
    ctx.frame.focusRects.set(focusKey({ kind: "basic", action }), cell);
    // A status owns the button it cancels (Components.dc.html section 05):
    // stunned hatches Attack, confused hatches Thwart, in that status's hue.
    // Still pressable when the engine allows it — attacking while stunned is a
    // legal play that spends the stun, and sometimes the right one.
    const power = action === "attack" || action === "thwart" ? action : null;
    const cancelledBy =
      power && model.me.disabledActions.includes(power) ? status[power === "attack" ? "stunned" : "confused"] : null;
    // How many characters could go. More than one opens the "Attack with" picker, so the count is on the button;
    // and the ✕ only stays while every one of them is cancelled — a stunned hero with a ready ally can still attack.
    const sources = power ? controller.powerSourcesFor(power) : [];
    const allCancelled = sources.every((source) => source.cancelledBy !== null);
    const choosingSource = selection.kind === "choosingSource" && selection.power === action;
    const choosingForm = action === "changeForm" && selection.kind === "choosingForm";
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "onInk",
        label: cancelledBy && allCancelled ? `${labels[action]} ✕` : labels[action],
        ...(sources.length > 1 ? { value: `×${sources.length}` } : {}),
        ...(action === "changeForm" && formSources.length > 1 ? { value: `×${formSources.length}` } : {}),
        type: typeRole.label,
        rect: cell,
        enabled: button?.enabled ?? false,
        selected: targeting || choosingSource || choosingForm,
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
