/**
 * Draws a pending choice's source card at readable size — the thing a "hero response is to discard a card" or a
 * "villain attacks and i can pay for a card to interrupt" popup was missing (PLAN.md Phase 4, the reported bug this
 * module and `view/choice-source-panel.ts` exist to fix). One draw routine, shared by the choice sheet's rail/strip
 * (`scenes/choice.ts`) and the villain-phase inline interrupt's own compact strip (`scenes/villain-phase.ts`), so the
 * two surfaces can never draw the same view model two different ways.
 *
 * Pure rendering: every field it draws already comes from `ChoiceSourcePanel`. Hold or right-click the art opens
 * Inspect for the card's full text (`ui/hold-target.ts`, the table's own card gesture) — this panel itself only ever
 * shows a name, a type line (rail only), the ability/cost line, and as much rules text as its own placement fits.
 */

import type Phaser from "phaser";
import type { SetupInstructionSource } from "@mc/engine";
import { cardArt, drawArt } from "../art/card-art.js";
import type { ChoiceSourcePanel } from "../view/choice-source-panel.js";
import { instructionHeaderName } from "../view/choice-source.js";
import type { SourcePanelPlacement } from "../view/choice-source-panel-layout.js";
import { RULES_TEXT_TABLE_LINES, ink, surface, typeRole } from "../tokens.js";
import { bindHoldTarget } from "./hold-target.js";
import { textStyle } from "./theme.js";
import { fitText, label, paintPanel } from "./widgets.js";

export function drawSourceCardPanel(
  scene: Phaser.Scene,
  placement: SourcePanelPlacement,
  panel: ChoiceSourcePanel,
  onInspect?: () => void,
): void {
  const outer = placement.mode === "rail" ? placement.rail : placement.strip;
  if (outer.width <= 0 || outer.height <= 0) return;

  const g = scene.add.graphics();
  paintPanel(g, outer, "card", "rest");

  const art = placement.mode === "rail" ? placement.art : placement.thumb;
  if (art.width > 0 && art.height > 0) {
    const artFill = scene.add.graphics();
    artFill.fillStyle(surface.parchment.hex, 1).fillRect(art.x, art.y, art.width, art.height);
    const key = cardArt(scene).request(scene, panel.art);
    if (!drawArt(scene, key, art, { fit: "contain" })) {
      label(
        scene,
        art.x + art.width / 2,
        art.y + art.height / 2,
        "no scan",
        typeRole.label,
        surface.ink.hex,
        ink.meta,
      ).setOrigin(0.5);
    }
    if (onInspect) {
      const zone = scene.add
        .zone(art.x, art.y, art.width, art.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      bindHoldTarget(scene, zone, { key: `source:${panel.instanceId}`, onTap: onInspect, onInspect });
    }
  }

  const { x: textX, y: textY, width: textWidth, height: textHeight } = placement.text;
  if (textWidth <= 0 || textHeight <= 0) return;

  label(scene, textX, textY, "SOURCE CARD", typeRole.label, surface.ink.hex, ink.label);
  let cursorY = textY + 13;

  const nameSize = placement.mode === "rail" ? 15 : 13;
  const nameText = scene.add
    .text(textX, cursorY, panel.name, textStyle({ ...typeRole.rowTitle, size: nameSize }, surface.ink.hex))
    .setOrigin(0, 0)
    .setWordWrapWidth(textWidth)
    .setMaxLines(placement.mode === "rail" ? 2 : 1);
  fitText(nameText, textWidth, nameSize);
  cursorY += nameText.height + 3;

  if (placement.mode === "rail" && panel.typeLine) {
    const typeText = scene.add
      .text(textX, cursorY, panel.typeLine, textStyle(typeRole.label, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0)
      .setWordWrapWidth(textWidth)
      .setMaxLines(1);
    cursorY += typeText.height + 4;
  }

  if (panel.abilityLine) {
    const abilityText = scene.add
      .text(textX, cursorY, panel.abilityLine, textStyle(typeRole.emphasis, surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(textWidth)
      .setMaxLines(placement.mode === "rail" ? 2 : 1);
    cursorY += abilityText.height + 4;
  }

  const rulesBottom = textY + textHeight;
  if (cursorY >= rulesBottom) return;

  if (placement.mode === "strip") {
    // The compact strip: the design's own table cap on rules text — the full wording is one hold/right-click away.
    scene.add
      .text(textX, cursorY, panel.rulesText, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0)
      .setWordWrapWidth(textWidth)
      .setMaxLines(RULES_TEXT_TABLE_LINES);
    return;
  }

  // The rail: as many lines as its own placement actually has room for. It's sized to the sheet's full height
  // (`sourceRailPlacement`), so this is normally the card's *entire* rules text, not a table-cap truncation.
  const lineHeight = typeRole.body.size * typeRole.body.lineHeight;
  const linesFit = Math.max(0, Math.floor((rulesBottom - cursorY) / lineHeight));
  if (linesFit > 0) {
    scene.add
      .text(textX, cursorY, panel.rulesText, textStyle(typeRole.body, surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(textWidth)
      .setMaxLines(linesFit);
  }
}

const INSTRUCTION_PAD_RAIL = 12;
const INSTRUCTION_PAD_STRIP = 8;

/**
 * A pending choice's source panel when there is no card to show — a setup instruction instead (MC27 p. 22's
 * reputation node 9: "Setup: In player order, each player must search…", `view/choice-source.ts`'s
 * `choiceInstructionOf`). Same outer frame and placement as `drawSourceCardPanel`, but text-only throughout: no
 * art slot to reserve, so the whole placement (minus its own padding) is the text column.
 */
export function drawInstructionSourcePanel(
  scene: Phaser.Scene,
  placement: SourcePanelPlacement,
  instruction: SetupInstructionSource,
): void {
  const outer = placement.mode === "rail" ? placement.rail : placement.strip;
  if (outer.width <= 0 || outer.height <= 0) return;

  const g = scene.add.graphics();
  paintPanel(g, outer, "card", "rest");

  const pad = placement.mode === "rail" ? INSTRUCTION_PAD_RAIL : INSTRUCTION_PAD_STRIP;
  const textX = outer.x + pad;
  const textY = outer.y + pad;
  const textWidth = Math.max(0, outer.width - pad * 2);
  const textHeight = Math.max(0, outer.height - pad * 2);
  if (textWidth <= 0 || textHeight <= 0) return;

  label(scene, textX, textY, "SOURCE", typeRole.label, surface.ink.hex, ink.label);
  let cursorY = textY + 13;

  const headerSize = placement.mode === "rail" ? 15 : 13;
  const headerText = scene.add
    .text(
      textX,
      cursorY,
      instructionHeaderName(instruction),
      textStyle({ ...typeRole.rowTitle, size: headerSize }, surface.ink.hex),
    )
    .setOrigin(0, 0)
    .setWordWrapWidth(textWidth)
    .setMaxLines(2);
  fitText(headerText, textWidth, headerSize);
  cursorY += headerText.height + 3;

  const citationText = scene.add
    .text(textX, cursorY, instruction.citation, textStyle(typeRole.label, surface.ink.hex, ink.secondary))
    .setOrigin(0, 0)
    .setWordWrapWidth(textWidth)
    .setMaxLines(1);
  cursorY += citationText.height + 4;

  const bottom = textY + textHeight;
  if (cursorY >= bottom) return;

  if (placement.mode === "strip") {
    // The compact strip: the design's own table cap on rules text, same as `drawSourceCardPanel`'s own strip case.
    scene.add
      .text(textX, cursorY, instruction.text, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0)
      .setWordWrapWidth(textWidth)
      .setMaxLines(RULES_TEXT_TABLE_LINES);
    return;
  }

  const lineHeight = typeRole.body.size * typeRole.body.lineHeight;
  const linesFit = Math.max(0, Math.floor((bottom - cursorY) / lineHeight));
  if (linesFit > 0) {
    scene.add
      .text(textX, cursorY, instruction.text, textStyle(typeRole.body, surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(textWidth)
      .setMaxLines(linesFit);
  }
}
