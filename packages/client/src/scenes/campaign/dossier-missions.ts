/**
 * The Dossier's mission table (Age of Apocalypse, MC45 p. 24), drawn: the four mission rows with where each stands and
 * what its result did, and the five Overseers beneath. Plain drawing over `MissionTable`
 * (`view/campaign-mission-model.ts`). Every state is a word as well as a mark; none is color alone.
 */
import Phaser from "phaser";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import { bangers, ruleHeading } from "../../ui/campaign-chrome.js";
import { textStyle } from "../../ui/theme.js";
import { fitText } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import type { MissionState, MissionTable } from "../../view/campaign-mission-model.js";

const ROW_HEIGHT = 52;
const OVERSEER_HEIGHT = 30;

const MARK: Readonly<Record<MissionState | "overseer-defeated", { readonly mark: string; readonly hue: number }>> = {
  available: { mark: "○", hue: surface.ink.hex },
  drawn: { mark: "◆", hue: signal.cost.hex },
  defeated: { mark: "✓", hue: signal.heal.hex },
  notDefeated: { mark: "✕", hue: accent.heroRed.hex },
  "overseer-defeated": { mark: "✓", hue: signal.heal.hex },
};

/** Draws the table at `rect.x`/`rect.y`, `rect.width` wide, and returns its bottom edge. */
export function drawMissionTable(scene: Phaser.Scene, rect: Rect, table: MissionTable): number {
  let y = ruleHeading(scene, rect.x, rect.y, rect.width, table.label);
  const top = y;
  const g = scene.add.graphics();
  table.missions.forEach((row, index) => {
    const rowTop = top + index * ROW_HEIGHT;
    if (index > 0) g.lineStyle(1, surface.ink.hex, 0.2).lineBetween(rect.x, rowTop, rect.x + rect.width, rowTop);
    const look = MARK[row.state];
    const stateText = scene.add
      .text(rect.x + rect.width - 12, rowTop + 14, `${look.mark} ${row.stateWord}`, {
        ...textStyle(typeRole.label, look.hue, 1),
        fontSize: "11px",
        fontStyle: "700",
      })
      .setOrigin(1, 0.5);
    const name = scene.add
      .text(rect.x + 12, rowTop + 14, row.name.toUpperCase(), textStyle(bangers(18), surface.ink.hex))
      .setOrigin(0, 0.5);
    fitText(name, rect.width - 24 - stateText.width - 8, 18);
    if (row.detail) {
      const text = scene.add
        .text(rect.x + 12, rowTop + 32, row.detail, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setOrigin(0, 0)
        .setFontSize(11);
      fitText(text, rect.width - 24, 11);
    }
  });
  const bottom = top + table.missions.length * ROW_HEIGHT;
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, top, rect.width, bottom - top);
  y = bottom + 16;

  y = ruleHeading(scene, rect.x, y, rect.width, table.overseersLabel);
  const overseersTop = y;
  table.overseers.forEach((row, index) => {
    const rowTop = overseersTop + index * OVERSEER_HEIGHT;
    if (index > 0) g.lineStyle(1, surface.ink.hex, 0.2).lineBetween(rect.x, rowTop, rect.x + rect.width, rowTop);
    const look = MARK[row.state === "defeated" ? "overseer-defeated" : row.state];
    const stateText = scene.add
      .text(rect.x + rect.width - 12, rowTop + OVERSEER_HEIGHT / 2, `${look.mark} ${row.stateWord}`, {
        ...textStyle(typeRole.label, look.hue, 1),
        fontSize: "11px",
        fontStyle: "700",
      })
      .setOrigin(1, 0.5);
    const name = scene.add
      .text(rect.x + 12, rowTop + OVERSEER_HEIGHT / 2, row.name.toUpperCase(), textStyle(bangers(16), surface.ink.hex))
      .setOrigin(0, 0.5);
    fitText(name, rect.width - 24 - stateText.width - 8, 16);
    if (row.state === "defeated") {
      g.lineStyle(2, surface.ink.hex, 1).lineBetween(name.x, name.y, name.x + name.displayWidth, name.y);
    }
  });
  const overseersBottom = overseersTop + table.overseers.length * OVERSEER_HEIGHT;
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, overseersTop, rect.width, overseersBottom - overseersTop);
  return overseersBottom + 16;
}
