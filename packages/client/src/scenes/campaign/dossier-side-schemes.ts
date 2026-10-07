/**
 * The Dossier's player-side-scheme table (NeXt Evolution, MC40 p. 24), drawn: the six rows with where each stands,
 * and the log's other tallies beneath. Plain drawing over `SideSchemeTable` (`view/campaign-side-scheme-model.ts`).
 * A removed row is struck through and also carries the word REMOVED; no state is color alone.
 */
import Phaser from "phaser";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import { bangers, ruleHeading } from "../../ui/campaign-chrome.js";
import { textStyle } from "../../ui/theme.js";
import { fitText } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import type { SideSchemeTable, SideSchemeTableRow } from "../../view/campaign-side-scheme-model.js";

const ROW_HEIGHT = 52;

/** The state word a row wears, and the hue that backs it (the word carries the meaning, the hue only echoes it). */
function stateOf(row: SideSchemeTableRow): { readonly word: string; readonly hue: number } {
  switch (row.state) {
    case "removed":
      return { word: "✕ REMOVED", hue: accent.heroRed.hex };
    case "earned":
      return { word: "✓ EARNED", hue: signal.heal.hex };
    case "chosen":
      return { word: row.scenarioNumber ? `CHOSEN · #${row.scenarioNumber}` : "CHOSEN", hue: signal.cost.hex };
    default:
      return { word: "OPEN", hue: surface.ink.hex };
  }
}

/** Draws the table at `rect.x`/`rect.y`, `rect.width` wide, and returns its bottom edge. */
export function drawSideSchemeTable(scene: Phaser.Scene, rect: Rect, table: SideSchemeTable): number {
  let y = ruleHeading(scene, rect.x, rect.y, rect.width, table.label);
  const top = y;
  const g = scene.add.graphics();
  table.rows.forEach((row, index) => {
    const rowTop = top + index * ROW_HEIGHT;
    if (index > 0) g.lineStyle(1, surface.ink.hex, 0.2).lineBetween(rect.x, rowTop, rect.x + rect.width, rowTop);
    if (row.state === "removed")
      g.fillStyle(0xe4dcc6, 1).fillRect(rect.x + 1, rowTop + 1, rect.width - 2, ROW_HEIGHT - 2);
    const state = stateOf(row);
    const stateText = scene.add
      .text(rect.x + rect.width - 12, rowTop + 14, state.word, {
        ...textStyle(typeRole.label, state.hue, 1),
        fontSize: "11px",
        fontStyle: "700",
      })
      .setOrigin(1, 0.5);
    const nameWidth = rect.width - 24 - stateText.width - 8;
    const name = scene.add
      .text(
        rect.x + 12,
        rowTop + 14,
        row.name.toUpperCase(),
        textStyle(bangers(18), surface.ink.hex, row.state === "removed" ? 0.6 : 1),
      )
      .setOrigin(0, 0.5);
    fitText(name, nameWidth, 18);
    if (row.struck) {
      const lineY = name.y;
      g.lineStyle(2, surface.ink.hex, 1).lineBetween(name.x, lineY, name.x + name.displayWidth, lineY);
    }
    const detail = [row.environment?.name, row.encounterAdded ? "card added" : null].filter(Boolean).join(" · ");
    if (detail) {
      const text = scene.add
        .text(rect.x + 12, rowTop + 32, detail, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setOrigin(0, 0)
        .setFontSize(11);
      fitText(text, rect.width - 24, 11);
    }
  });
  const bottom = top + table.rows.length * ROW_HEIGHT;
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, top, rect.width, bottom - top);
  y = bottom + 16;

  if (table.tallies.length > 0) {
    y = ruleHeading(scene, rect.x, y, rect.width, "So far");
    const columns = rect.width >= 560 ? 2 : 1;
    const cell = Math.floor(rect.width / columns);
    table.tallies.forEach((tally, index) => {
      const x = rect.x + (index % columns) * cell;
      const cellY = y + Math.floor(index / columns) * 30;
      scene.add
        .text(x + 4, cellY + 4, tally.label, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setFontSize(12);
      const value = scene.add
        .text(x + cell - 12, cellY + 4, tally.value, textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex))
        .setOrigin(1, 0);
      value.setX(x + cell - 12);
    });
    y += Math.ceil(table.tallies.length / columns) * 30;
  }
  return y;
}
