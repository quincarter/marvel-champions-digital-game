import { customBadge } from "../../../view/custom-content.js";
import { accent, ink, signal, surface, typeRole } from "../../../tokens.js";
import { bangers } from "../../../ui/campaign-chrome.js";
import { caseOf } from "../../../ui/theme.js";
import { type SagaVolumeRow } from "../../../view/campaign-saga-model.js";
import { gridChipOf } from "../../../view/campaign-saga-copy.js";
import { volumeNameIn } from "../../../campaign/campaign-text.js";
import type { Rect } from "../../../view/layout.js";
import { t } from "../../../i18n/translate.js";
import { SheetBuilder } from "../../../dom/sheet-builder.js";
import { TILE_GROUND, type SagaCtx } from "./context.js";
import { CHIP_COLORS } from "./art.js";
import { pictureOf, wrapped } from "./art.js";

/**
 * A dark grid tile on the shelf ("ALL VOLUMES ───"): box code, a huge "VOL. N", the box's name, a status chip
 * (color by status; an outline for sealed) and — when the box has art — a dimmed thumbnail behind it all. `selected`
 * draws the red ring around whichever tile is currently featured.
 */
export function drawTile(ctx: SagaCtx, b: SheetBuilder, tileRow: SagaVolumeRow, rect: Rect): void {
  const volume = tileRow.volume;
  b.box(rect, { fill: TILE_GROUND });
  const art = pictureOf(ctx, volume, true);
  if (art.src !== null) {
    b.image(rect, {
      src: art.src,
      cover: { x: 0.5, y: 0.15 },
      key: `tile-art-${volume.number}`,
      ...(art.retry !== undefined ? { retry: art.retry } : {}),
    });
    b.box(rect, { fill: TILE_GROUND, fillAlpha: 0.5 });
  }
  b.dots(rect, "ink", 6, 1, 0.1);

  b.text(
    rect.x + 11,
    rect.y + 9,
    caseOf(typeRole.label, volume.custom ? volume.custom.packName : volume.boxCode),
    typeRole.label,
    {
      color: surface.paper.hex,
      alpha: ink.meta,
      letterSpacing: 1,
    },
  );

  const colors = CHIP_COLORS[tileRow.status];
  const adjustedFlag = tileRow.status === "done" && tileRow.wonAdjustedOnly;
  const flagWord = caseOf(typeRole.label, t("saga.adjusted"));
  const flagWidth = adjustedFlag ? b.measure(flagWord, typeRole.label, { letterSpacing: 0.9 }).width : 0;
  const full = gridChipOf(tileRow).toLocaleUpperCase();
  const chipRoom = Math.max(40, rect.width - 22 - 14 - 8);
  const fullWidth = wrapped(b, full, typeRole.label, chipRoom, { letterSpacing: 0.9 }).width;
  const fitsBeside = !adjustedFlag || 11 + fullWidth + 14 + 6 + flagWidth + 14 <= rect.width - 11;
  // In a narrow tile (a phone's two-column Grid View, a landscape tablet) the chip gives way to its short form.
  const chipText = adjustedFlag && !fitsBeside ? "✓" : full;
  const chipSize = wrapped(b, chipText, typeRole.label, chipRoom, { letterSpacing: 0.9 });
  const chipHeight = Math.max(19, chipSize.height + 7);
  const chipY = rect.y + rect.height - 10 - chipHeight;
  const titleSize = Math.min(46, rect.width * 0.24, rect.height * 0.24);

  // Laid out bottom-up (chip, then subtitle, then title) so a two-line box name never collides with the chip below it.
  const name = volumeNameIn(volume).toLocaleUpperCase();
  const subtitleSize = Math.min(20, rect.width * 0.1);
  const subtitle = b.measure(name, bangers(subtitleSize, 1), { wrapWidth: rect.width - 22 });
  const subtitleY = chipY - 14 - subtitle.height;
  b.text(rect.x + 11, subtitleY, name, bangers(subtitleSize, 1), {
    color: surface.paper.hex,
    wrapWidth: rect.width - 22,
  });
  const titleText = (volume.custom ? customBadge() : t("saga.volume", { number: volume.number })).toLocaleUpperCase();
  const titleHeight = b.measure(titleText, bangers(titleSize, 1)).height;
  b.text(rect.x + 11, subtitleY - 2 - titleHeight, titleText, bangers(titleSize, 1), { color: surface.paper.hex });

  const chipRect: Rect = { x: rect.x + 11, y: chipY, width: chipSize.width + 14, height: chipHeight };
  if (colors.fill !== null) b.box(chipRect, { fill: colors.fill });
  else
    b.box(
      { x: chipRect.x + 0.75, y: chipRect.y + 0.75, width: chipRect.width - 1.5, height: chipRect.height - 1.5 },
      { stroke: surface.paper.hex, strokeWidth: 1.5, alpha: 0.45 },
    );
  b.text(chipRect.x + 7, chipRect.y + chipRect.height / 2, chipText, typeRole.label, {
    color: colors.text,
    letterSpacing: 0.9,
    origin: [0, 0.5],
    wrapWidth: chipRoom,
  });
  if (adjustedFlag) {
    const flagRect: Rect = {
      x: chipRect.x + chipRect.width + 6,
      y: chipRect.y,
      width: flagWidth + 14,
      height: chipRect.height,
    };
    b.box(flagRect, { fill: signal.caution.hex });
    b.text(flagRect.x + 7, flagRect.y + flagRect.height / 2, flagWord, typeRole.label, {
      color: surface.inkOnHue.hex,
      letterSpacing: 0.9,
      origin: [0, 0.5],
    });
  }

  if (tileRow.status === "sealed") b.box(rect, { fill: surface.ink.hex, fillAlpha: 0.4 });
  if (tileRow.volume.number === ctx.state.featured) {
    b.box(
      { x: rect.x + 2, y: rect.y + 2, width: rect.width - 4, height: rect.height - 4 },
      { stroke: accent.heroRed.hex, strokeWidth: 4 },
    );
    b.box(
      { x: rect.x + 5, y: rect.y + 5, width: rect.width - 10, height: rect.height - 10 },
      { stroke: surface.paper.hex, strokeWidth: 2 },
    );
  }
}

/** One row of the phone's list: the volume number block, the name, the box code and the status chip. */
export function drawPhoneVolumeRow(ctx: SagaCtx, b: SheetBuilder, row: SagaVolumeRow, rect: Rect): void {
  const rowRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height - 6 };
  b.box(rowRect, { fill: surface.parchment.hex });
  b.box(
    { x: rowRect.x + 1.5, y: rowRect.y + 1.5, width: rowRect.width - 3, height: rowRect.height - 3 },
    { stroke: surface.ink.hex, strokeWidth: 3 },
  );
  const blockW = 58;
  b.box({ x: rowRect.x, y: rowRect.y, width: blockW, height: rowRect.height }, { fill: surface.ink.hex });
  const tag = row.volume.custom
    ? `${customBadge()}\n▸`
    : `${t("saga.volumeShort").toLocaleUpperCase()}\n${row.volume.number}`;
  b.text(rowRect.x + blockW / 2, rowRect.y + rowRect.height / 2, tag, bangers(15, 1), {
    color: surface.paper.hex,
    origin: [0.5, 0.5],
    align: "center",
  });
  b.text(rowRect.x + blockW + 10, rowRect.y + 6, volumeNameIn(row.volume).toLocaleUpperCase(), bangers(16, 1), {
    color: surface.ink.hex,
    wrapWidth: rowRect.width - blockW - 24,
  });
  b.text(
    rowRect.x + blockW + 10,
    rowRect.y + rowRect.height - 18,
    caseOf(typeRole.label, row.volume.custom ? row.volume.custom.packName : row.volume.boxCode),
    typeRole.label,
    { size: 9, color: surface.ink.hex, alpha: ink.meta },
  );

  const colors = row.status === "sealed" ? { fill: null, text: surface.ink.hex } : CHIP_COLORS[row.status];
  const chipText = gridChipOf(row).toLocaleUpperCase();
  const chipWidth = b.measure(chipText, typeRole.label, { size: 9, letterSpacing: 0.6 }).width;
  const chipRect: Rect = {
    x: rowRect.x + rowRect.width - 10 - chipWidth - 12,
    // On the row's own bottom line, beside the box code: a long name ("AGENTS OF S.H.I.E.L.D.") has the whole top line.
    y: rowRect.y + rowRect.height - 8 - 20,
    width: chipWidth + 12,
    height: 20,
  };
  if (colors.fill !== null) b.box(chipRect, { fill: colors.fill });
  else
    b.box(
      { x: chipRect.x + 0.75, y: chipRect.y + 0.75, width: chipRect.width - 1.5, height: chipRect.height - 1.5 },
      { stroke: surface.ink.hex, strokeWidth: 1.5, alpha: 0.45 },
    );
  b.text(chipRect.x + 6, chipRect.y + chipRect.height / 2, chipText, typeRole.label, {
    size: 9,
    color: colors.text,
    letterSpacing: 0.6,
    origin: [0, 0.5],
  });
  // A volume won only by adjusted runs (issue #869): an amber "ADJUSTED" chip just before the "✓ COMPLETE" one.
  if (row.status === "done" && row.wonAdjustedOnly) {
    const flag = caseOf(typeRole.label, t("saga.adjusted"));
    const flagWidth = b.measure(flag, typeRole.label, { size: 9, letterSpacing: 0.6 }).width;
    const flagRect: Rect = {
      x: chipRect.x - 6 - flagWidth - 12,
      y: chipRect.y,
      width: flagWidth + 12,
      height: chipRect.height,
    };
    b.box(flagRect, { fill: signal.caution.hex });
    b.text(flagRect.x + 6, flagRect.y + flagRect.height / 2, flag, typeRole.label, {
      size: 9,
      color: surface.inkOnHue.hex,
      letterSpacing: 0.6,
      origin: [0, 0.5],
    });
  }

  if (row.status === "sealed") b.box(rowRect, { fill: surface.paper.hex, fillAlpha: 0.45 });
  if (row.volume.number === ctx.state.featured) b.box(rowRect, { stroke: accent.heroRed.hex, strokeWidth: 3 });
}

/** The Custom campaigns section's header: the section named in words, ruled like ALL VOLUMES. */
export function drawCustomHeader(ctx: SagaCtx, b: SheetBuilder, rect: Rect): void {
  const label = t("saga.customCampaigns").toLocaleUpperCase();
  const width = b.measure(label, typeRole.barTitle, { size: 14, letterSpacing: 0.6 }).width;
  b.text(rect.x, rect.y + rect.height / 2, label, typeRole.barTitle, {
    size: 14,
    color: surface.ink.hex,
    letterSpacing: 0.6,
    origin: [0, 0.5],
  });
  const ruleX = rect.x + width + 12;
  b.box(
    { x: ruleX, y: rect.y + rect.height / 2 - 1.5, width: Math.max(0, rect.x + rect.width - ruleX), height: 3 },
    { fill: surface.ink.hex },
  );
}
