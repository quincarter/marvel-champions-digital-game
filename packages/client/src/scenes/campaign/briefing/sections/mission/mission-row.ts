/**
 * One mission or Overseer row: a green stripe, the kind in red capitals, the card's name in the display face, a short line and
 * an Inspect chip at the right that opens the card. The row grows to hold a long line instead of cutting it.
 */
import { cardId } from "@mc/content";
import { t } from "../../../../../i18n/translate.js";
import { accent, hit, ink, signal, surface, typeRole } from "../../../../../tokens.js";
import { bangers } from "../../../../../ui/campaign-chrome.js";
import { drawInspectChip } from "../parts/inspect-chip.js";
import { drawFramedRow, drawKicker } from "../parts/kicker.js";
import type { SectionBase } from "../sections.types.js";
import type { MissionEvents, MissionRowModel } from "./mission.types.js";

const MIN_HEIGHT = 58;
const CHIP_WIDTH = 92;

/** Draws the row from `top`; returns its bottom. */
export function drawMissionRow({ ctx, b, col, top }: SectionBase, row: MissionRowModel, events: MissionEvents): number {
  const chip = row.cardId !== null ? CHIP_WIDTH + 8 : 0;
  const textWidth = col.width - 28 - chip;
  const size = col.phone ? 18 : 20;
  const title = b.measure(row.name.toLocaleUpperCase(), bangers(size), { fitWidth: textWidth });
  const detail = row.detail ? b.measure(row.detail, typeRole.body, { size: 11, wrapWidth: textWidth }) : null;
  const height = Math.max(MIN_HEIGHT, 6 + 14 + title.height + (detail ? 2 + detail.height : 0) + 8);
  drawFramedRow(b, { x: col.x, y: top, width: col.width, height }, { stripe: signal.heal.hex });
  drawKicker(b, col.x + 16, top + 6, row.kind, accent.heroRed.hex);
  b.text(col.x + 16, top + 20, row.name.toLocaleUpperCase(), bangers(size), {
    color: surface.ink.hex,
    fitWidth: textWidth,
  });
  if (detail) {
    b.text(col.x + 16, top + 20 + title.height + 2, row.detail, typeRole.body, {
      size: 11,
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: textWidth,
    });
  }
  if (row.cardId !== null) {
    const id = cardId(row.cardId);
    drawInspectChip(
      ctx,
      b,
      col,
      {
        x: col.x + col.width - 12 - CHIP_WIDTH,
        y: top + (height - hit.target) / 2,
        width: CHIP_WIDTH,
        height: hit.target,
      },
      t("briefing.mission.inspect"),
      `mission-${row.key}`,
      () => events.inspect({ cardId: id, name: row.name }),
    );
  }
  return top + height;
}
