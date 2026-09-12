/**
 * The threat zone: the main scheme and up to three side schemes.
 */

import { drawArt } from "../../art/card-art.js";
import { ink, surface, threatMeter, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { label, paintPanel } from "../../ui/widgets.js";
import type { BoardModel, SchemePanel } from "../../view/board-model.js";
import type { Rect } from "../../view/layout.js";
import type { BoardDrawContext } from "./context.js";
import { dimAlpha, targetState } from "./selection.js";

export function drawSchemes(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const g = ctx.scene.add.graphics();
  paintPanel(g, rect, "card", "rest");
  let y = rect.y + 10;

  y = drawScheme(ctx, { x: rect.x + 10, y, width: rect.width - 20, height: 92 }, model.mainScheme);
  for (const side of model.sideSchemes.slice(0, 3)) {
    y = drawScheme(ctx, { x: rect.x + 10, y: y + 6, width: rect.width - 20, height: 52 }, side);
  }
}

/**
 * A scheme with the design's threat meter: fill is always Hero Red. The art
 * sits in a column on the left with a 3px rule beside it, which is how the
 * Long Table canvas frames a scheme. Returns the bottom edge it drew to.
 */
function drawScheme(ctx: BoardDrawContext, rect: Rect, scheme: SchemePanel): number {
  const { scene } = ctx;
  const selection = ctx.controller.selection;
  ctx.frame.hitRects.set(scheme.instanceId, rect);
  const g = scene.add.graphics();
  paintPanel(g, rect, "card", targetState(selection, scheme.instanceId));

  const dim = dimAlpha(selection, scheme.instanceId);
  // The art column earns its place whenever the name and the meter still fit
  // beside it. The old threshold was tuned for the long table and silently
  // dropped the main scheme's card on every narrower panel.
  const artWidth = rect.width >= 170 ? Math.round(Math.min(96, rect.width * 0.3)) : 0;
  if (artWidth > 0) {
    const column: Rect = { x: rect.x + 3, y: rect.y + 3, width: artWidth, height: rect.height - 6 };
    const frame = scene.add.graphics();
    frame.fillStyle(surface.parchment.hex, dim).fillRect(column.x, column.y, column.width, column.height);
    const key = ctx.art.request(scene, scheme.art);
    if (!drawArt(scene, key, column, { alpha: dim, focusY: 0.3 })) {
      label(scene, column.x + column.width / 2, column.y + column.height / 2, "art", typeRole.label, surface.ink.hex, ink.meta * dim).setOrigin(0.5);
    }
    const rule = scene.add.graphics();
    rule.fillStyle(surface.ink.hex, dim).fillRect(column.x + column.width, column.y, 3, column.height);
  }

  const textLeft = rect.x + 8 + (artWidth > 0 ? artWidth + 6 : 0);
  const textWidth = rect.x + rect.width - 8 - textLeft;
  scene.add
    .text(textLeft, rect.y + 6, scheme.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
    .setWordWrapWidth(textWidth)
    .setMaxLines(2);
  label(scene, textLeft, rect.y + 30, scheme.subtitle, typeRole.label, surface.ink.hex, ink.label * dim);

  const meter: Rect = { x: textLeft, y: rect.y + rect.height - 26, width: textWidth, height: 18 };
  const mg = scene.add.graphics();
  mg.fillStyle(surface.parchment.hex, dim).fillRect(meter.x, meter.y, meter.width, meter.height);
  // Drawn against `meterMax`, not `target`: a side scheme has no threshold but
  // still has somewhere it started from, and a bar that empties as it is
  // thwarted says more than a bare number beside a main scheme that has one.
  if (scheme.meterMax && scheme.meterMax > 0) {
    const ratio = Math.min(1, scheme.threat / scheme.meterMax);
    mg.fillStyle(threatMeter.fill.hex, dim).fillRect(meter.x, meter.y, meter.width * ratio, meter.height);
  }
  mg.lineStyle(2, surface.ink.hex, dim).strokeRect(meter.x, meter.y, meter.width, meter.height);
  scene.add
    .text(
      meter.x + meter.width / 2,
      meter.y + meter.height / 2,
      scheme.target === null ? `${scheme.threat} THREAT` : `${scheme.threat} / ${scheme.target} THREAT`,
      textStyle(typeRole.statSmall, surface.ink.hex, dim),
    )
    .setOrigin(0.5);

  ctx.makeTapTarget(rect, scheme.instanceId);
  return rect.y + rect.height;
}
