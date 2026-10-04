/**
 * The Briefing's modular-set call, drawn: the question, its one-line explanation, one tile per set and the two
 * lines under them (the checked-off rule, "what is a genre set"). Plain drawing over `ModularSetCallView`
 * (`view/campaign-modular-call-model.ts`); the scene owns the answer and the redraw.
 */
import Phaser from "phaser";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import { bangers } from "../../ui/campaign-chrome.js";
import { textStyle } from "../../ui/theme.js";
import { fitText, label } from "../../ui/widgets.js";
import type { ModularSetCallView, ModularSetTile } from "../../view/campaign-modular-call-model.js";
import type { FocusStop } from "../focus-route.js";
import type { Rect } from "../../view/layout.js";

/** Tile grid shape for a column `width` wide: two columns on a phone, three where there is room. */
export function modularTileColumns(width: number, phone: boolean): number {
  if (phone || width < 420) return 2;
  return width >= 640 ? 3 : 2;
}

const TILE_HEIGHT = 78;
const TILE_GAP = 10;

/** Draws the call at (`rect.x`, `y`) and returns the bottom edge. */
export function drawModularCall(
  scene: Phaser.Scene,
  rect: Rect,
  top: number,
  view: ModularSetCallView,
  phone: boolean,
  onPick: (id: string) => void,
  stops: Map<string, FocusStop>,
): number {
  let y = top;
  const question = scene.add
    .text(rect.x, y, view.question, textStyle(typeRole.rowTitle, surface.ink.hex))
    .setOrigin(0, 0)
    .setWordWrapWidth(rect.width);
  y += question.height + 4;
  const explain = scene.add
    .text(rect.x, y, view.explain, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
    .setOrigin(0, 0)
    .setWordWrapWidth(rect.width);
  y += explain.height + 12;

  const columns = modularTileColumns(rect.width, phone);
  const tileWidth = Math.floor((rect.width - TILE_GAP * (columns - 1)) / columns);
  view.tiles.forEach((tile, index) => {
    const x = rect.x + (index % columns) * (tileWidth + TILE_GAP);
    const tileY = y + Math.floor(index / columns) * (TILE_HEIGHT + TILE_GAP);
    drawTile(scene, { x, y: tileY, width: tileWidth, height: TILE_HEIGHT }, tile, onPick, stops);
  });
  y += Math.ceil(view.tiles.length / columns) * (TILE_HEIGHT + TILE_GAP) + 2;

  const lines = [view.rule, view.whatIs].filter((line): line is string => line !== null);
  const notes = scene.add
    .text(rect.x, y, lines.join("\n"), {
      ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      fontSize: "11px",
    })
    .setOrigin(0, 0)
    .setWordWrapWidth(rect.width)
    .setLineSpacing(4);
  return y + notes.height;
}

function drawTile(
  scene: Phaser.Scene,
  tileRect: Rect,
  tile: ModularSetTile,
  onPick: (id: string) => void,
  stops: Map<string, FocusStop>,
): void {
  const { x, y, width, height } = tileRect;
  const unavailable = !tile.available;
  scene.add.rectangle(x, y, width, height, unavailable ? 0xe4dcc6 : 0xfffaf0).setOrigin(0, 0);
  // A chosen set wears a heal-green stripe and its words; a checked-off one is dashed-out in words as well as tone.
  const g = scene.add.graphics();
  g.lineStyle(unavailable ? 1 : 2, surface.ink.hex, unavailable ? 0.4 : 1).strokeRect(x, y, width, height);
  if (tile.status === "chosen") g.fillStyle(signal.heal.hex, 1).fillRect(x, y, 6, height);
  const dim = unavailable && tile.status !== "chosen" ? 0.55 : 1;
  const name = scene.add
    .text(x + 14, y + 8, tile.name.toUpperCase(), textStyle(bangers(22), surface.ink.hex))
    .setOrigin(0, 0)
    .setAlpha(dim);
  fitText(name, width - 28, 22);
  scene.add
    .text(x + 14, y + 36, tile.detail, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
    .setOrigin(0, 0)
    .setWordWrapWidth(width - 28);
  if (tile.statusLabel) {
    const color =
      tile.status === "chosen" ? signal.heal.hex : tile.status === "reusable" ? signal.cost.hex : accent.heroRed.hex;
    const status = label(scene, x + 14, y + height - 8, tile.statusLabel, { ...typeRole.label, size: 9 }, color, 1);
    status.setOrigin(0, 1);
    fitText(status, width - 28, 9);
  }
  if (!tile.available) return;
  const zone = scene.add.zone(x, y, width, height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  const pick = (): void => onPick(tile.id);
  zone.on(Phaser.Input.Events.POINTER_UP, pick);
  stops.set(`call-option:${tile.id}`, { rect: tileRect, activate: pick });
}
