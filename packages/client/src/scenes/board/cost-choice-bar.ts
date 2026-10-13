/**
 * The either/or branch, or "up to N counters", picker that sits over the hand while a cost like The Grand
 * Collection's ("Choose to either exhaust your hero or spend 2 resources of any type →") or We Are Groot's
 * ("Remove up to 4 growth counters from Groot →") waits on the player's own decision — made up front, before the
 * cost can even be priced (docs/phase7-wave3.md §3.32, §3.36; `view/cost-choice-model.ts`).
 */

import { accent, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { McButton, fitText } from "../../ui/widgets.js";
import type { CostChoicePrompt } from "../../view/cost-choice-model.js";
import type { CostHelpPrompt } from "../../view/cost-help-model.js";
import type { Rect } from "../../view/layout.js";
import type { BoardDrawContext } from "./context.js";

/** Framed exactly like the controller/payment bars — Hero Red, over the hand — for the same reason: the play is half-made and waiting on one more pick. */
export function drawCostChoiceBar(ctx: BoardDrawContext, rect: Rect, prompt: CostChoicePrompt): void {
  const { scene, controller } = ctx;
  const g = scene.add.graphics();
  g.fillStyle(accent.heroRed.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, 3);

  const titleText = prompt.kind === "branch" ? "Choose how to pay" : `How many ${prompt.label}?`;
  const titleWidth = Math.min(220, rect.width * 0.28);
  const title = scene.add
    .text(rect.x + 12, rect.y + rect.height / 2, titleText, textStyle(typeRole.barTitle, surface.paper.hex))
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);
  fitText(title, titleWidth - 16, typeRole.barTitle.size);

  const cancelWidth = Math.max(64, Math.min(110, rect.width * 0.12));
  const gap = 6;
  const left = rect.x + titleWidth;
  const right = rect.x + rect.width - cancelWidth - 10 - gap;

  if (prompt.kind === "branch") {
    const count = Math.max(1, prompt.options.length);
    const width = Math.max(60, (right - left - gap * (count - 1)) / count);
    prompt.options.forEach((option, index) => {
      ctx.frame.buttons.push(
        new McButton(scene, {
          kind: "secondary",
          label: option.label,
          type: typeRole.label,
          rect: { x: left + index * (width + gap), y: rect.y + 4, width, height: rect.height - 8 },
          onClick: () => void controller.chooseCostBranch(option.branch),
        }),
      );
    });
  } else {
    const values = Array.from({ length: prompt.max - prompt.min + 1 }, (_, i) => prompt.min + i);
    const count = Math.max(1, values.length);
    const width = Math.max(40, Math.min(56, (right - left - gap * (count - 1)) / count));
    values.forEach((value, index) => {
      ctx.frame.buttons.push(
        new McButton(scene, {
          kind: value === prompt.max ? "primary" : "secondary",
          label: String(value),
          type: typeRole.label,
          rect: { x: left + index * (width + gap), y: rect.y + 4, width, height: rect.height - 8 },
          onClick: () => void controller.chooseCostCounters(value),
        }),
      );
    });
  }

  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "quiet",
      label: "Cancel",
      type: typeRole.label,
      rect: { x: rect.x + rect.width - cancelWidth - 10, y: rect.y + 4, width: cancelWidth, height: rect.height - 8 },
      onClick: () => controller.cancel(),
    }),
  );
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
    ctx.frame.buttons.push(
      new McButton(scene, {
        kind: "secondary",
        label: option.label,
        type: typeRole.label,
        rect: { x: left + index * (width + gap), y: top + 4, width, height: row - 8 },
        onClick: () => void controller.chooseCostHelper(option.playerId),
      }),
    );
  });
  ctx.frame.buttons.push(
    new McButton(scene, {
      kind: "quiet",
      label: "Cancel",
      type: typeRole.label,
      rect: { x: rect.x + rect.width - cancelWidth - 10, y: top + 4, width: cancelWidth, height: row - 8 },
      onClick: () => controller.cancel(),
    }),
  );
}
