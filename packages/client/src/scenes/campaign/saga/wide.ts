import { ink, surface, typeRole } from "../../../tokens.js";
import { campaignFrame } from "../../../ui/campaign-chrome.js";
import { caseOf } from "../../../ui/theme.js";
import { type SagaVolumeRow } from "../../../view/campaign-saga-model.js";
import type { Rect } from "../../../view/layout.js";
import { t } from "../../../i18n/translate.js";
import { SheetBuilder } from "../../../dom/sheet-builder.js";
import { WIDE_TILE_COLUMNS, TILE_GAP, MORE_HEIGHT, type SagaCtx } from "./context.js";
import { drawVolumes } from "./volumes.js";
import { drawFeaturedCard } from "./card.js";

export function drawWide(
  ctx: SagaCtx,
  b: SheetBuilder,
  frame: ReturnType<typeof campaignFrame>,
  topHeight: number,
  row: SagaVolumeRow,
): void {
  const gutter = frame.gutter;
  const cardWidth = Math.round(((frame.width - gutter * 3) * 1) / 2.6);
  const cardRect: Rect = {
    x: gutter,
    y: topHeight + gutter,
    width: cardWidth,
    height: frame.height - topHeight - gutter * 2,
  };
  drawFeaturedCard(ctx, b, cardRect, row, false);

  const gridX = cardRect.x + cardRect.width + gutter;
  const gridWidth = frame.width - gridX - gutter;
  let y = topHeight + gutter;
  const heading = t("saga.allVolumes").toLocaleUpperCase();
  const headingType = { ...typeRole.barTitle };
  b.text(gridX, y, heading, headingType, { size: 18, color: surface.ink.hex, letterSpacing: 0.6 });
  const headingWidth = b.measure(heading, headingType, { size: 18, letterSpacing: 0.6 }).width;
  const ruleX = gridX + headingWidth + 12;
  b.box(
    { x: ruleX, y: y + 11 - 1.5, width: Math.max(0, gridX + gridWidth - ruleX), height: 3 },
    { fill: surface.ink.hex },
  );
  y += 32;

  // Three rows of tiles fill the column; a box past those scrolls, so a new one needs no layout of its own.
  const footnoteHeight = 34;
  const height = frame.height - y - gutter - footnoteHeight - MORE_HEIGHT;
  const tileHeight = Math.floor((height - TILE_GAP * 2) / 3);
  const listRect: Rect = { x: gridX, y, width: gridWidth, height: (tileHeight + TILE_GAP) * 3 };
  drawVolumes(ctx, b, listRect, { columns: WIDE_TILE_COLUMNS, height: tileHeight });

  b.text(gridX, listRect.y + listRect.height + MORE_HEIGHT, caseOf(typeRole.label, t("saga.note")), typeRole.label, {
    color: surface.ink.hex,
    alpha: ink.meta,
    wrapWidth: gridWidth,
  });
}
