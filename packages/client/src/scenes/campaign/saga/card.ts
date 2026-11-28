import { customBadge } from "../../../view/custom-content.js";
import { accent, ink, signal, surface, typeRole } from "../../../tokens.js";
import { bangers } from "../../../ui/campaign-chrome.js";
import { caseOf } from "../../../ui/theme.js";
import { type SagaVolumeRow } from "../../../view/campaign-saga-model.js";
import { altsOf, featuredCopyOf } from "../../../view/campaign-saga-copy.js";
import { volumeNameIn } from "../../../campaign/campaign-text.js";
import type { Rect } from "../../../view/layout.js";
import { t } from "../../../i18n/translate.js";
import { SheetBuilder } from "../../../dom/sheet-builder.js";
import { drawIssuePips } from "../../../dom/issue-pips.js";
import { type SagaCtx } from "./context.js";
import { volumeTagOf, turnedCorners } from "./art.js";
import { drawCta, drawAlt } from "./buttons.js";
import { pictureOf } from "./art.js";

export function drawFeaturedCard(ctx: SagaCtx, b: SheetBuilder, rect: Rect, row: SagaVolumeRow, phone: boolean): void {
  b.box(rect, { stroke: accent.heroRed.hex, strokeWidth: 6 });
  b.box(
    { x: rect.x + 3, y: rect.y + 3, width: rect.width - 6, height: rect.height - 6 },
    { stroke: surface.ink.hex, strokeWidth: 3 },
  );
  const copy = featuredCopyOf(row);
  // The adjusted-run note (issue #869) adds a line under the roster: the art gives up that much, not the buttons.
  const noteHeight = row.status === "done" && row.adjustedWinKeepsNextSealed ? (phone ? 15 : 17) : 0;
  const footerHeight = Math.min(rect.height * 0.5, phone ? 210 : 270) + noteHeight;
  const artRect: Rect = {
    x: rect.x + 3,
    y: rect.y + 3,
    width: rect.width - 6,
    height: rect.height - 6 - footerHeight,
  };
  const footerRect: Rect = {
    x: rect.x + 3,
    y: artRect.y + artRect.height,
    width: rect.width - 6,
    height: footerHeight,
  };

  drawFeaturedArt(ctx, b, artRect, row);

  drawArtBadges(ctx, b, artRect, row, phone);

  b.box(footerRect, { fill: surface.ink.hex });

  const pad = phone ? 12 : 18;
  let y = footerRect.y + (phone ? 10 : 16);
  const statusLine = `${copy.status} · ${row.volume.custom ? `${customBadge()} · ${row.volume.custom.packName}` : row.volume.boxCode}`;
  b.text(footerRect.x + pad, y, caseOf(typeRole.label, statusLine.toLocaleUpperCase()), typeRole.label, {
    color: signal.caution.hex,
    letterSpacing: 1,
  });
  if (copy.right) {
    b.text(footerRect.x + footerRect.width - pad, y, copy.right.toLocaleUpperCase(), typeRole.label, {
      color: surface.paper.hex,
      alpha: ink.meta,
      origin: [1, 0],
      letterSpacing: 1,
    });
  }
  y += 18;

  const nameType = bangers(phone ? 28 : 44, 0.92);
  const name = volumeNameIn(row.volume).toLocaleUpperCase();
  const nameBox = b.text(footerRect.x + pad, y, name, nameType, {
    color: surface.paper.hex,
    wrapWidth: footerRect.width - pad * 2,
  });
  y += nameBox.height + 9;

  if (copy.hasPips) {
    drawIssuePips(b, { x: footerRect.x + pad, y, width: footerRect.width - pad * 2, height: phone ? 7 : 8 }, row.pips);
    y += phone ? 15 : 18;
  }

  const subBox = b.text(footerRect.x + pad, y, copy.sub, typeRole.emphasis, {
    size: phone ? 11 : 12,
    color: surface.paper.hex,
    alpha: ink.secondary,
    wrapWidth: footerRect.width - pad * 2,
  });
  y += subBox.height + (phone ? 8 : 10);

  // Phone draws this screen's one CTA in the bottom action bar instead (`#drawPhone`) — the card itself keeps
  // going below the sub line (DOSSIER/START OVER + footnote, or nothing at all), matching the phone composition.
  if (!phone) {
    const ctaHeight = 58;
    drawCta(ctx, b, { x: footerRect.x + pad, y, width: footerRect.width - pad * 2, height: ctaHeight }, row, 21);
    y += ctaHeight + 8;
  }

  const alts = altsOf(row, ctx.state.confirmAbandon);
  if (alts.length > 0) {
    const altHeight = phone ? 40 : 48;
    const altWidth = (footerRect.width - pad * 2 - 8) / 2;
    alts.forEach((alt, index) => {
      const altRect: Rect = { x: footerRect.x + pad + index * (altWidth + 8), y, width: altWidth, height: altHeight };
      drawAlt(ctx, b, altRect, alt, index, row, phone ? 15 : 19);
    });
    y += altHeight + 6;
    if (copy.foot) {
      const footSize = phone ? 9.5 : 10.5;
      const footText = caseOf(typeRole.label, copy.foot);
      const foot = b.measure(footText, typeRole.label, { size: footSize, wrapWidth: footerRect.width - pad * 2 });
      // The footnote is the one optional line: where the card is too short for it (an iPhone SE, a two-line box name),
      // it goes rather than running through the card's border.
      if (y + foot.height <= footerRect.y + footerRect.height - 4) {
        b.text(footerRect.x + pad, y, footText, typeRole.label, {
          size: footSize,
          color: surface.paper.hex,
          alpha: ink.meta,
          wrapWidth: footerRect.width - pad * 2,
        });
      }
    }
  }
}

/** The art's "VOL. N" tab and, for a finished volume, its tilted COMPLETE (and ADJUSTED) stamps. */
export function drawArtBadges(ctx: SagaCtx, b: SheetBuilder, artRect: Rect, row: SagaVolumeRow, phone: boolean): void {
  // "VOL. N" tab
  const tagText = volumeTagOf(row.volume);
  const tagSize = b.measure(tagText, bangers(18, 1));
  b.box(
    { x: artRect.x, y: artRect.y, width: tagSize.width + 20, height: tagSize.height + 12 },
    { fill: signal.caution.hex },
  );
  b.text(artRect.x + 10, artRect.y + 6, tagText, bangers(18, 1), { color: surface.inkOnHue.hex });
  if (row.status === "done") {
    // Solid green with paper-white text, the grid tile's own "✓ Complete" chip colors. Tilted about its own center.
    const word = t("saga.status.complete").toLocaleUpperCase();
    const stampType = bangers(phone ? 18 : 26, 1);
    const stamp = b.measure(word, stampType);
    const cx = artRect.x + artRect.width - stamp.width / 2 - 24;
    const cy = artRect.y + stamp.height / 2 + 20;
    const tilt = 0.14;
    b.poly(turnedCorners(cx, cy, stamp.width + 20, stamp.height + 8, tilt), { fill: signal.heal.hex });
    b.text(cx, cy, word, stampType, {
      color: surface.paper.hex,
      origin: [0.5, 0.5],
      angle: (tilt * 180) / Math.PI,
    });
    // A volume complete only by adjusted runs (issue #869) gets a second stamp under the first, in caution amber.
    if (row.wonAdjustedOnly) {
      const adjustedWord = t("saga.adjusted").toLocaleUpperCase();
      const adjustedType = bangers(phone ? 15 : 21, 1);
      const adjusted = b.measure(adjustedWord, adjustedType);
      const ax = cx + 6;
      const ay = cy + stamp.height / 2 + adjusted.height / 2 + 16;
      b.poly(turnedCorners(ax, ay, adjusted.width + 16, adjusted.height + 6, tilt), { fill: signal.caution.hex });
      b.text(ax, ay, adjustedWord, adjustedType, {
        color: surface.inkOnHue.hex,
        origin: [0.5, 0.5],
        angle: (tilt * 180) / Math.PI,
      });
    }
  }
}

export function drawFeaturedArt(ctx: SagaCtx, b: SheetBuilder, rect: Rect, row: SagaVolumeRow): void {
  const art = pictureOf(ctx, row.volume, false);
  if (art.src !== null) {
    b.image(rect, {
      src: art.src,
      cover: { x: 0.5, y: 0.15 },
      fill: surface.ink.hex,
      key: "featured-art",
      ...(art.retry !== undefined ? { retry: art.retry } : {}),
    });
    return;
  }
  b.box(rect, { fill: surface.ink.hex });
  // A pack campaign with no cover gets its first letter, big, on the ink: a generated cover.
  const glyph = row.volume.custom
    ? row.volume.name.slice(0, 1).toUpperCase()
    : row.status === "sealed" && !row.hasDefinition
      ? "?"
      : `${row.volume.number}`;
  b.text(rect.x + rect.width / 2, rect.y + rect.height / 2, glyph, bangers(Math.min(rect.width, rect.height) * 0.5), {
    color: surface.paper.hex,
    alpha: 0.18,
    origin: [0.5, 0.5],
  });
}
