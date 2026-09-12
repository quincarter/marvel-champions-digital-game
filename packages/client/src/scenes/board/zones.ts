/**
 * The Board's remaining table zones: enemies, the encounter piles, the game
 * log, your play area and the other heroes' seats.
 */

import type Phaser from "phaser";
import { drawArt } from "../../art/card-art.js";
import { CARD_BACKS, type ArtSource } from "../../art/art-source.js";
import { ink, signal, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { label, paintPanel } from "../../ui/widgets.js";
import type { BoardModel } from "../../view/board-model.js";
import { cardRow, type Rect } from "../../view/layout.js";
import type { LogState } from "../../view/log-lines.js";
import { drawCharacter } from "./character-panel.js";
import type { BoardDrawContext } from "./context.js";

export function drawEnemies(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const g = ctx.scene.add.graphics();
  paintPanel(g, rect, "card", "rest");

  const villainRect: Rect = { x: rect.x + 10, y: rect.y + 10, width: Math.min(280, rect.width - 20), height: 128 };
  drawCharacter(ctx, villainRect, model.villain);

  const minionTop = villainRect.y + villainRect.height + 8;
  const minionArea: Rect = {
    x: rect.x + 10,
    y: minionTop,
    width: rect.width - 20,
    height: Math.max(0, rect.y + rect.height - minionTop - 10),
  };
  if (model.minions.length > 0 && minionArea.height > 40) {
    const slots = cardRow(minionArea, model.minions.length, { gap: 8, maxHeight: minionArea.height });
    model.minions.forEach((minion, index) => drawCharacter(ctx, slots[index]!, minion));
  }
}

/**
 * The encounter piles. The deck is a facedown stack, so it shows the
 * encounter back — the same back every facedown encounter card shows, which
 * is what makes a stack read as a stack rather than as a number in a box.
 * The discard is faceup at the table, so it shows its top card.
 */
export function drawEncounter(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const { scene } = ctx;
  const half = (rect.height - 6) / 2;
  const piles: readonly { name: string; count: number; y: number; art: ArtSource | null }[] = [
    { name: "ENC DECK", count: model.encounterPiles.deck, y: rect.y, art: CARD_BACKS.encounter },
    { name: "DISCARD", count: model.encounterPiles.discard, y: rect.y + half + 6, art: model.encounterDiscardTop },
  ];
  for (const { name, count, y, art } of piles) {
    const box: Rect = { x: rect.x, y, width: rect.width, height: half };
    const g = scene.add.graphics();
    paintPanel(g, box, count > 0 ? "card" : "quiet", count > 0 ? "rest" : "unavailable");

    const inner: Rect = { x: box.x + 3, y: box.y + 3, width: box.width - 6, height: box.height - 6 };
    const drawn = count > 0 && drawArt(scene, ctx.art.request(scene, art), inner, { fit: "cover" }) !== null;

    label(scene, box.x + 6, box.y + 6, name, typeRole.label, drawn ? surface.paper.hex : surface.ink.hex, drawn ? ink.body : ink.label);
    // The count rides on an ink chip over the art, so it stays readable.
    const chip: Rect = { x: box.x + 4, y: box.y + box.height - 26, width: box.width - 8, height: 22 };
    if (drawn) {
      const chipG = scene.add.graphics();
      chipG.fillStyle(surface.ink.hex, 0.78).fillRect(chip.x, chip.y, chip.width, chip.height);
    }
    scene.add
      .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(count), textStyle(typeRole.stat, drawn ? surface.paper.hex : surface.ink.hex))
      .setOrigin(0.5);
  }
}

/** The game log, virtualized: only the lines that fit exist as objects. */
export function drawLog(scene: Phaser.Scene, rect: Rect, log: LogState): void {
  const g = scene.add.graphics();
  paintPanel(g, rect, "rail", "rest");
  label(scene, rect.x + 6, rect.y + 5, "LOG", typeRole.label, surface.ink.hex, ink.label);

  const lineHeight = 26;
  const capacity = Math.max(0, Math.floor((rect.height - 24) / lineHeight));
  const visible = log.lines.slice(-capacity);
  visible.forEach((line, index) => {
    const y = rect.y + 22 + index * lineHeight;
    label(scene, rect.x + 6, y, line.ref, typeRole.mono, surface.ink.hex, ink.meta);
    scene.add
      .text(rect.x + 6, y + 11, line.text, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setWordWrapWidth(rect.width - 12)
      // Two lines on the table at most; the rest is one tap away in Inspect.
      .setMaxLines(1);
  });
}

export function drawPlayArea(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, rect, "rail", "rest");
  label(scene, rect.x + 8, rect.y + 6, "your play area", typeRole.label, surface.ink.hex, ink.label);

  const inner: Rect = { x: rect.x + 8, y: rect.y + 22, width: rect.width - 16, height: rect.height - 30 };
  if (model.myPlayArea.length === 0) {
    // A dashed slot: present, not yet filled.
    const empty = scene.add.graphics();
    paintPanel(empty, inner, "quiet", "unavailable");
    scene.add
      .text(inner.x + inner.width / 2, inner.y + inner.height / 2, "Play a card to put it here", textStyle(typeRole.body, surface.ink.hex, ink.meta))
      .setOrigin(0.5);
    return;
  }
  const slots = cardRow(inner, model.myPlayArea.length, { gap: 8, maxHeight: inner.height });
  model.myPlayArea.forEach((panel, index) => drawCharacter(ctx, slots[index]!, panel));
}

export function drawTeam(scene: Phaser.Scene, rect: Rect, model: BoardModel): void {
  const g = scene.add.graphics();
  paintPanel(g, rect, "rail", "rest");
  label(scene, rect.x + 8, rect.y + 6, "other heroes", typeRole.label, surface.ink.hex, ink.label);

  const rowHeight = Math.min(58, (rect.height - 28) / Math.max(1, model.team.length));
  model.team.forEach((seat, index) => {
    const row: Rect = { x: rect.x + 8, y: rect.y + 24 + index * (rowHeight + 4), width: rect.width - 16, height: rowHeight };
    const rg = scene.add.graphics();
    paintPanel(rg, row, "card", seat.eliminated ? "unavailable" : "rest");
    const alpha = seat.eliminated ? ink.illegal : 1;
    scene.add.text(row.x + 6, row.y + 5, seat.name, textStyle(typeRole.rowTitle, surface.ink.hex, alpha));
    label(
      scene,
      row.x + 6,
      row.y + 22,
      `${seat.form === "hero" ? "Hero" : "Alter-ego"} · ${seat.hp ? `${seat.hp.current}/${seat.hp.max} HP` : "—"} · ${seat.handCount} cards`,
      typeRole.label,
      surface.ink.hex,
      ink.label * alpha,
    );
    if (seat.done) {
      label(scene, row.x + row.width - 40, row.y + 5, "done", typeRole.label, signal.heal.hex, ink.body);
    }
    if (seat.isFirstPlayer) {
      label(scene, row.x + row.width - 40, row.y + 22, "1st", typeRole.label, signal.caution.hex, ink.body);
    }
  });
}
