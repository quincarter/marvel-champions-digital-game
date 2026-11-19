/**
 * The either/or branch, or "up to N counters", picker that sits over the hand while a cost like The Grand
 * Collection's ("Choose to either exhaust your hero or spend 2 resources of any type →") or We Are Groot's
 * ("Remove up to 4 growth counters from Groot →") waits on the player's own decision — made up front, before the
 * cost can even be priced (docs/phase7-wave3.md §3.32, §3.36; `view/cost-choice-model.ts`).
 */

import { accent, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { fitText, fitWrapped } from "../../ui/widgets.js";
import { costChoiceTitle, type CostChoicePrompt } from "../../view/cost-choice-model.js";
import type { CostHelpPrompt } from "../../view/cost-help-model.js";
import { costCountsLayout } from "../../view/cost-choice-layout.js";
import type { Rect } from "../../view/layout.js";
import { BAR_ROW } from "../../view/payment-bar-layout.js";
import { addBarButton, addBarCancel } from "./bar-stops.js";
import type { BoardDrawContext } from "./context.js";

/** Framed exactly like the controller/payment bars — Hero Red, over the hand — for the same reason: the play is half-made and waiting on one more pick. */
export function drawCostChoiceBar(ctx: BoardDrawContext, rect: Rect, prompt: CostChoicePrompt): void {
  const g = ctx.scene.add.graphics();
  g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);
  if (prompt.kind === "counters") drawCounts(ctx, rect, prompt);
  else drawBranches(ctx, rect, prompt);
}

/**
 * The bar's height for this prompt over a hand `width` wide: one usual bar row (`BAR_ROW`), taller when the counts
 * stack under their question or wrap (`costCountsLayout`).
 */
export function costChoiceBarHeight(width: number, prompt: CostChoicePrompt): number {
  return prompt.kind === "counters" ? costCountsLayout(width, BAR_ROW, prompt.max - prompt.min + 1).height : BAR_ROW;
}

function drawBranches(ctx: BoardDrawContext, rect: Rect, prompt: Extract<CostChoicePrompt, { kind: "branch" }>): void {
  const { scene, controller } = ctx;
  const titleWidth = Math.min(220, rect.width * 0.28);
  const title = scene.add
    .text(
      rect.x + 12,
      rect.y + rect.height / 2,
      costChoiceTitle(prompt),
      textStyle(typeRole.barTitle, surface.paper.hex),
    )
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);
  fitText(title, titleWidth - 16, typeRole.barTitle.size);

  const cancelWidth = Math.max(64, Math.min(110, rect.width * 0.12));
  const gap = 6;
  const left = rect.x + titleWidth;
  const right = rect.x + rect.width - cancelWidth - 10 - gap;
  const count = Math.max(1, prompt.options.length);
  const width = Math.max(60, (right - left - gap * (count - 1)) / count);
  prompt.options.forEach((option, index) => {
    addBarButton(ctx, {
      kind: "secondary",
      label: option.label,
      type: typeRole.label,
      rect: { x: left + index * (width + gap), y: rect.y + 4, width, height: rect.height - 8 },
      onClick: () => void controller.chooseCostBranch(option.branch),
    });
  });
  addBarCancel(ctx, {
    kind: "quiet",
    label: "Cancel",
    type: typeRole.label,
    rect: { x: rect.x + rect.width - cancelWidth - 10, y: rect.y + 4, width: cancelWidth, height: rect.height - 8 },
    onClick: () => controller.cancel(),
  });
}

function drawCounts(ctx: BoardDrawContext, rect: Rect, prompt: Extract<CostChoicePrompt, { kind: "counters" }>): void {
  const { scene, controller } = ctx;
  const values = Array.from({ length: prompt.max - prompt.min + 1 }, (_, i) => prompt.min + i);
  // Rows of the usual bar height, so the counts and Cancel keep the usual 44 px controls on every row.
  const layout = costCountsLayout(rect.width, BAR_ROW, values.length);
  const at = (box: { x: number; y: number; width: number; height: number }): Rect => ({
    x: rect.x + box.x,
    y: rect.y + box.y,
    width: box.width,
    height: box.height,
  });

  const question = at(layout.question);
  const title = scene.add
    .text(
      question.x,
      layout.question.stacked ? question.y : question.y + question.height / 2,
      costChoiceTitle(prompt),
      textStyle(typeRole.barTitle, surface.paper.hex),
    )
    .setOrigin(0, layout.question.stacked ? 0 : 0.5)
    .setLetterSpacing(1);
  // Beside the counts the question may take two lines rather than shrink past reading size; on its own line it has the
  // bar's width.
  if (layout.question.stacked) fitText(title, question.width, typeRole.barTitle.size);
  else fitWrapped(title, question.width, 2, typeRole.barTitle.size);

  values.forEach((value, index) => {
    // Every count is a paper button, as on every other red bar: a "primary" button is Hero Red, so the most-counters
    // choice drew red on red and read as plain text (issue #856). No count is the bar's forward stop: Start does not
    // pick one for the player.
    addBarButton(ctx, {
      kind: "secondary",
      label: String(value),
      type: typeRole.barTitle,
      rect: at(layout.counts[index]!),
      onClick: () => void controller.chooseCostCounters(value),
    });
  });
  addBarCancel(ctx, {
    kind: "quiet",
    label: "Cancel",
    type: typeRole.label,
    rect: at(layout.cancel),
    onClick: () => controller.cancel(),
  });
}

/** Height of the line that gives the engine's reason a player cannot take a part (`drawCostHelpBar`). */
export const COST_HELP_NOTE_ROW = 22;

/**
 * "Who takes the damage? — You / Spider-Man — Cancel": the question an ability on a card any player may help pay asks
 * before its cost is priced (`LegalAction.costHelp`; `view/cost-help-model.ts`). A player who cannot take the part is
 * not a button; the engine's reason for them is written under the title, where the player looks to see why.
 */
export function drawCostHelpBar(ctx: BoardDrawContext, rect: Rect, prompt: CostHelpPrompt): void {
  const { scene, controller } = ctx;
  const g = scene.add.graphics();
  g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);

  const titleWidth = Math.min(260, rect.width * 0.34);
  const refusal = prompt.unavailable.map((who) => `${who.label}: ${who.reason}`).join(" ");
  // The reason is its own line above the buttons, so the row below keeps the usual 44px controls.
  const top = rect.y + (refusal ? COST_HELP_NOTE_ROW : 0);
  const row = rect.height - (refusal ? COST_HELP_NOTE_ROW : 0);
  const title = scene.add
    .text(rect.x + 12, top + row / 2, prompt.title, textStyle(typeRole.barTitle, surface.paper.hex))
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);
  fitText(title, titleWidth - 16, typeRole.barTitle.size);
  if (refusal) {
    const note = scene.add
      .text(rect.x + 12, rect.y + 6, `Cannot help: ${refusal}`, textStyle(typeRole.label, surface.paper.hex, 0.9))
      .setOrigin(0, 0);
    fitText(note, rect.width - 24, typeRole.label.size);
  }

  const cancelWidth = Math.max(64, Math.min(110, rect.width * 0.12));
  const gap = 6;
  const left = rect.x + titleWidth;
  const right = rect.x + rect.width - cancelWidth - 10 - gap;
  const count = Math.max(1, prompt.options.length);
  const width = Math.max(60, (right - left - gap * (count - 1)) / count);
  prompt.options.forEach((option, index) => {
    addBarButton(ctx, {
      kind: "secondary",
      label: option.label,
      type: typeRole.label,
      rect: { x: left + index * (width + gap), y: top + 4, width, height: row - 8 },
      onClick: () => void controller.chooseCostHelper(option.playerId),
    });
  });
  addBarCancel(ctx, {
    kind: "quiet",
    label: "Cancel",
    type: typeRole.label,
    rect: { x: rect.x + rect.width - cancelWidth - 10, y: top + 4, width: cancelWidth, height: row - 8 },
    onClick: () => controller.cancel(),
  });
}
