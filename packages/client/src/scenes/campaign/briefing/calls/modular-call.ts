/**
 * The modular-set call: the question, its one-line explanation, one tile per set and the two lines under them (the checked-off
 * rule, "what is a genre set"). A set already chosen wears a heal-green stripe and its words; one checked off is dimmed and says
 * so in words as well as tone. Plain drawing over `ModularSetCallView` (`view/campaign-modular-call-model.ts`).
 */
import { accent, ink, signal, surface, typeRole } from "../../../../tokens.js";
import type { ModularSetTile } from "../../../../view/campaign-modular-call-model.js";
import type { Rect } from "../../../../view/layout.js";
import type { CallInput, CallKind, OptionTileModel } from "./calls.types.js";
import { drawOptionTile } from "./option-tile.js";

type ModularKind = Extract<CallKind, { kind: "modular" }>;

const TILE_HEIGHT = 78;
const TILE_GAP = 10;

/** Tile grid shape for a column `width` wide: two columns on a phone, three where there is room. */
export function modularTileColumns(width: number, phone: boolean): number {
  if (phone || width < 420) return 2;
  return width >= 640 ? 3 : 2;
}

const statusColor = (tile: ModularSetTile): number =>
  tile.status === "chosen" ? signal.heal.hex : tile.status === "reusable" ? signal.cost.hex : accent.heroRed.hex;

/** A set's tile as the shared tile takes it. */
export function modularTileModel(tile: ModularSetTile, rect: Rect, pick: (id: string) => void): OptionTileModel {
  return {
    key: `call-option:${tile.id}`,
    rect,
    title: tile.name,
    body: tile.detail,
    ...(tile.statusLabel ? { footer: tile.statusLabel, footerColor: statusColor(tile) } : {}),
    available: tile.available,
    ...(tile.status === "chosen" ? { stripe: true } : {}),
    onPick: () => pick(tile.id),
  };
}

/** Draws the call from `top` and returns its bottom. */
export function drawModularCall(input: CallInput, top: number, kind: ModularKind): number {
  const { ctx, b, col } = input;
  const { view } = kind;
  let y = top;
  y += b.text(col.x, y, view.question, typeRole.rowTitle, { color: surface.ink.hex, wrapWidth: col.width }).height + 4;
  y +=
    b.text(col.x, y, view.explain, typeRole.body, {
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: col.width,
    }).height + 12;
  const columns = modularTileColumns(col.width, col.phone);
  const tileWidth = Math.floor((col.width - TILE_GAP * (columns - 1)) / columns);
  view.tiles.forEach((tile, index) => {
    const rect: Rect = {
      x: col.x + (index % columns) * (tileWidth + TILE_GAP),
      y: y + Math.floor(index / columns) * (TILE_HEIGHT + TILE_GAP),
      width: tileWidth,
      height: TILE_HEIGHT,
    };
    drawOptionTile(
      b,
      col,
      modularTileModel(tile, rect, (id) => ctx.answer([id])),
    );
  });
  y += Math.ceil(view.tiles.length / columns) * (TILE_HEIGHT + TILE_GAP) + 2;
  const lines = [view.rule, view.whatIs].filter((line): line is string => line !== null);
  return (
    y +
    b.text(col.x, y, lines.join("\n"), typeRole.body, {
      size: 11,
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: col.width,
      lineSpacing: 4,
    }).height
  );
}
