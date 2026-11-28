/**
 * The tile the role call and the modular-set call share: a framed paper tile with a Bangers name (and aspect chips at its right
 * end), a few words, a label at its foot and one press over all of it. A tile that cannot be picked is dimmed and says why in
 * words (never dimmed alone) and takes no press; one already chosen wears a heal-green stripe and its words.
 */
import { chipRunWidth, drawChipRun } from "../../../../dom/aspect-chips.js";
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import { accent, ink, signal, surface, typeRole } from "../../../../tokens.js";
import { bangers } from "../../../../ui/campaign-chrome.js";
import type { Column } from "../context.js";
import type { OptionTileModel } from "./calls.types.js";

const PAD = 12;

export function drawOptionTile(b: SheetBuilder, col: Column, tile: OptionTileModel): void {
  const { x, y, width, height } = tile.rect;
  const dim = tile.available || tile.stripe ? 1 : 0.5;
  b.box(tile.rect, { fill: tile.available ? surface.card.hex : surface.parchment.hex });
  // A switched-on tile (the easier start) wears a thick Hero Red frame; the state is in its words as well.
  b.box(
    tile.rect,
    tile.on
      ? { stroke: accent.heroRed.hex, strokeWidth: 4 }
      : {
          stroke: surface.ink.hex,
          strokeWidth: tile.available ? 2 : 1,
          ...(tile.available ? {} : { alpha: 0.4 }),
        },
  );
  if (tile.stripe) b.box({ x, y, width: 6, height }, { fill: signal.heal.hex });
  const stamps = tile.chips;
  const chipsWidth = stamps && stamps.length > 0 ? chipRunWidth(b, stamps) : 0;
  b.text(x + PAD, y + 8, tile.title.toLocaleUpperCase(), bangers(22), {
    color: surface.ink.hex,
    alpha: dim,
    fitWidth: Math.max(60, width - PAD * 2 - (chipsWidth > 0 ? chipsWidth + 8 : 0)),
  });
  if (stamps && chipsWidth > 0) drawChipRun(b, x + width - PAD, y + 10, stamps, true);
  b.text(x + PAD, y + 36, tile.body, tile.bodyWarn ? typeRole.label : typeRole.body, {
    ...(tile.bodyWarn ? { size: 10 } : {}),
    color: tile.bodyWarn ? accent.heroRed.hex : surface.ink.hex,
    alpha: tile.bodyWarn ? 1 : ink.secondary,
    wrapWidth: width - PAD * 2,
  });
  if (tile.footer) {
    b.text(x + PAD, y + height - 8, tile.footer, typeRole.label, {
      size: 10,
      color: tile.footerColor ?? surface.ink.hex,
      alpha: tile.footerColor === undefined ? ink.secondary : 1,
      origin: [0, 1],
      fitWidth: width - PAD * 2,
    });
  }
  if (!tile.available) return;
  b.tap(tile.key, tile.rect);
  col.control(tile.key, tile.rect, tile.onPick);
}
