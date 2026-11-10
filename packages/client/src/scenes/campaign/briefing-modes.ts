/**
 * The Briefing's mode section (`view/campaign-modes-model.ts`), drawn: a heading and one row per mode, its name and line
 * of state over full-size chips drawn as Table setup's are (ink when chosen, the state in words as well as in color). Plain
 * drawing over the rows; the scene owns what a press does.
 */
import { hit, ink, surface, typeRole } from "../../tokens.js";
import { bangers, ruleHeading } from "../../ui/campaign-chrome.js";
import { textStyle } from "../../ui/theme.js";
import { McButton, fitText } from "../../ui/widgets.js";
import type { IssueModeRow } from "../../view/campaign-modes-model.js";
import type { SideSchemeDrawContext } from "./briefing-side-scheme.js";

const ROW_GAP = 10;
const CHIP_GAP = 6;
/** The widest a chip gets, so a two-chip row on a wide column doesn't read as two banners. */
const CHIP_MAX_WIDTH = 120;
const NAME_HEIGHT = 22;

/** Draws the section below `top` and returns its bottom edge. */
export function drawIssueModes(
  ctx: SideSchemeDrawContext,
  top: number,
  rows: readonly IssueModeRow[],
  act: (action: string) => void,
): number {
  const { scene, rect } = ctx;
  let y = ruleHeading(scene, rect.x, top, rect.width, "Modes for this issue", surface.ink.hex, 20) + 4;
  for (const row of rows) {
    const name = scene.add
      .text(rect.x, y, row.name.toUpperCase(), textStyle(bangers(16), surface.ink.hex, 1))
      .setOrigin(0, 0);
    const meta = scene.add
      .text(rect.x + name.width + 10, y + 2, row.meta, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0);
    fitText(meta, rect.width - name.width - 10, typeRole.body.size);
    y += NAME_HEIGHT;
    const width = Math.min(
      CHIP_MAX_WIDTH,
      (rect.width - CHIP_GAP * (row.chips.length - 1)) / Math.max(1, row.chips.length),
    );
    row.chips.forEach((chip, index) => {
      const chipRect = { x: rect.x + index * (width + CHIP_GAP), y, width, height: hit.target };
      const onClick = (): void => act(chip.action);
      if (chip.enabled) {
        ctx.buttons.push(
          new McButton(scene, { kind: "quiet", label: "", type: typeRole.label, rect: chipRect, onClick }),
        );
        ctx.stops.set(`mode:${chip.action}`, { rect: chipRect, activate: onClick });
      }
      const g = scene.add.graphics();
      g.fillStyle(chip.selected ? surface.ink.hex : surface.card.hex, 1).fillRect(
        chipRect.x,
        chipRect.y,
        chipRect.width,
        chipRect.height,
      );
      g.lineStyle(2, surface.ink.hex, 1).strokeRect(
        chipRect.x + 1,
        chipRect.y + 1,
        chipRect.width - 2,
        chipRect.height - 2,
      );
      const label = scene.add
        .text(
          chipRect.x + width / 2,
          chipRect.y + hit.target / 2,
          chip.label,
          textStyle(typeRole.sectionHeader, chip.selected ? surface.paper.hex : surface.ink.hex, 1),
        )
        .setOrigin(0.5);
      fitText(label, width - 8, typeRole.sectionHeader.size);
    });
    y += hit.target + ROW_GAP;
  }
  return y - ROW_GAP;
}
