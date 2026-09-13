/**
 * The Board's remaining table zones: enemies, the encounter piles, your play
 * area and the other heroes' seats. The game log is `log.ts`.
 */

import type Phaser from "phaser";
import { drawArt } from "../../art/card-art.js";
import { CARD_BACKS, type ArtSource } from "../../art/art-source.js";
import { accent, ink, signal, status, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fitText, hatchRect, label, paintPanel } from "../../ui/widgets.js";
import type { BoardModel, SeatRow } from "../../view/board-model.js";
import { cardRow, type Rect } from "../../view/layout.js";
import { drawCharacter } from "./character-panel.js";
import { pileKey, type BoardDrawContext } from "./context.js";
import { dimAlpha, targetState } from "./selection.js";

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
  const piles: readonly { kind: "encounterDeck" | "encounterDiscard"; name: string; count: number; y: number; art: ArtSource | null }[] = [
    { kind: "encounterDeck", name: "ENC DECK", count: model.encounterPiles.deck, y: rect.y, art: CARD_BACKS.encounter },
    { kind: "encounterDiscard", name: "DISCARD", count: model.encounterPiles.discard, y: rect.y + half + 6, art: model.encounterDiscardTop },
  ];
  for (const { kind, name, count, y, art } of piles) {
    const box: Rect = { x: rect.x, y, width: rect.width, height: half };
    // A card revealed from the deck or discarded to the pile travels from or to this box itself, not the whole column.
    ctx.frame.pileRects.set(pileKey(kind), box);
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

export function drawTeam(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, rect, "rail", "rest");
  label(scene, rect.x + 8, rect.y + 6, "other heroes", typeRole.label, surface.ink.hex, ink.label);

  const rowHeight = Math.min(76, (rect.height - 28) / Math.max(1, model.team.length) - 4);
  model.team.forEach((seat, index) => {
    const row: Rect = { x: rect.x + 8, y: rect.y + 24 + index * (rowHeight + 4), width: rect.width - 16, height: rowHeight };
    // Registered like any card on the table: a beat on this hero ("−4")
    // floats off the row, a heal aimed at them rings it, and a tap reads them.
    ctx.frame.hitRects.set(seat.identityInstanceId, row);
    if (seat.eliminated) drawEliminatedSeat(scene, row, seat);
    else drawLiveSeat(ctx, row, seat);
    ctx.makeTapTarget(row, seat.identityInstanceId, () => ctx.inspect(seat.identityInstanceId));
  });
}

function drawLiveSeat(ctx: BoardDrawContext, row: Rect, seat: SeatRow): void {
  const { scene } = ctx;
  const rg = scene.add.graphics();
  paintPanel(rg, row, "card", targetState(ctx.controller.selection, seat.identityInstanceId));
  const dim = dimAlpha(ctx.controller.selection, seat.identityInstanceId);
  const rightColumn = 58;
  fitText(
    scene.add.text(row.x + 6, row.y + 5, seat.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim)),
    row.width - 12 - rightColumn,
    typeRole.rowTitle.size,
  );
  fitText(
    label(
      scene,
      row.x + 6,
      row.y + 22,
      `${seat.form === "hero" ? "Hero" : "Alter-ego"} · ${seat.hp ? `${seat.hp.current}/${seat.hp.max} HP` : "—"} · ${seat.handCount} cards`,
      typeRole.label,
      surface.ink.hex,
      ink.label * dim,
    ),
    row.width - 12,
    typeRole.label.size,
  );
  if (seat.isFirstPlayer) {
    label(scene, row.x + row.width - 6, row.y + 5, "1st player", typeRole.label, signal.caution.hex, ink.body).setOrigin(1, 0);
  }
  if (seat.done) {
    label(scene, row.x + row.width - 6, row.y + 22, "turn done", typeRole.label, signal.heal.hex, ink.body).setOrigin(1, 0);
  }

  // Third line: statuses as the design's pips, then anything aimed at or lent
  // to this seat — the things that change what this hero can do next.
  if (row.height < 52) return;
  const lineY = row.y + 37;
  let cursor = row.x + 6;
  for (const { status: name } of seat.statuses) {
    const pip = scene.add.graphics();
    pip.fillStyle(status[name].hex, dim).fillRect(cursor, lineY, 16, 16);
    pip.lineStyle(2, surface.ink.hex, dim).strokeRect(cursor, lineY, 16, 16);
    scene.add
      .text(cursor + 8, lineY + 8, name.charAt(0).toUpperCase(), {
        ...textStyle(typeRole.statSmall, name === "confused" ? surface.paper.hex : surface.ink.hex, dim),
        fontSize: "11px",
      })
      .setOrigin(0.5);
    cursor += 20;
  }
  const notes = [...seat.effects, ...seat.borrowed];
  if (notes.length > 0) {
    const room = row.x + row.width - 6 - cursor;
    const chip: Rect = { x: cursor, y: lineY, width: room, height: 16 };
    const cg = scene.add.graphics();
    cg.fillStyle(surface.ink.hex, dim).fillRect(chip.x, chip.y, chip.width, chip.height);
    cg.fillStyle(signal.caution.hex, dim).fillRect(chip.x, chip.y, 3, chip.height);
    fitText(
      label(scene, chip.x + 7, chip.y + chip.height / 2, notes.join(" · "), typeRole.label, signal.caution.hex, dim).setOrigin(0, 0.5),
      chip.width - 10,
      typeRole.label.size,
    );
  }
}

/**
 * A defeated hero stays at the table, visibly out of it: an ink tile hatched
 * in Hero Red with the name struck through and ELIMINATED stamped across.
 * Greying the row was all this used to do, and next to a stale "done" it read
 * as a hero sitting out a turn — three seats died over two rounds unnoticed.
 */
function drawEliminatedSeat(scene: Phaser.Scene, row: Rect, seat: SeatRow): void {
  const rg = scene.add.graphics();
  rg.fillStyle(surface.ink.hex, 1).fillRect(row.x, row.y, row.width, row.height);
  hatchRect(rg, row, accent.heroRed.hex, 0.3, 12, 3);
  rg.lineStyle(2, accent.heroRed.hex, 1).strokeRect(row.x, row.y, row.width, row.height);

  const name = scene.add.text(row.x + 6, row.y + 5, seat.name, textStyle(typeRole.rowTitle, surface.paper.hex, 0.6));
  fitText(name, row.width * 0.5, typeRole.rowTitle.size);
  rg.lineStyle(2, surface.paper.hex, 0.8).lineBetween(name.x - 2, name.y + name.height / 2, name.x + name.width + 2, name.y + name.height / 2);
  label(scene, row.x + 6, row.y + 22, "defeated · out of the game", typeRole.label, surface.paper.hex, ink.meta);

  const stamp = scene.add
    .text(row.x + row.width - 8, row.y + row.height / 2, "ELIMINATED", {
      ...textStyle(typeRole.barTitle, accent.heroRed.hex),
      stroke: cssOf(surface.ink.hex),
      strokeThickness: 3,
    })
    .setOrigin(1, 0.5)
    .setAngle(-6)
    .setLetterSpacing(1);
  fitText(stamp, row.width * 0.48, typeRole.barTitle.size);
}
