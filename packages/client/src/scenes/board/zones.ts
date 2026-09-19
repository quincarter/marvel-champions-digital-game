/**
 * The Board's remaining table zones: enemies, the encounter piles, your play
 * area and the other heroes' seats. The game log is `log.ts`.
 */

import type Phaser from "phaser";
import type { InstanceId, PlayerId } from "@mc/engine";
import { drawArt } from "../../art/card-art.js";
import { CARD_BACKS, type ArtSource } from "../../art/art-source.js";
import { accent, ink, signal, status, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fitText, hatchRect, label, paintPanel } from "../../ui/widgets.js";
import type { BoardModel, EnvironmentPanel, SeatRow, SeparateDeckPile, VillainPanel } from "../../view/board-model.js";
import { cardRow, villainRowSlots, type Rect } from "../../view/layout.js";
import { drawCharacter } from "./character-panel.js";
import { pileKey, type BoardDrawContext } from "./context.js";
import { drawPile } from "./piles.js";
import { addTapTarget } from "./tap-target.js";
import { dimAlpha, targetState } from "./selection.js";

export function drawEnemies(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const g = ctx.scene.add.graphics();
  paintPanel(g, rect, "card", "rest");

  // A single villain is every scenario before The Wrecking Crew, and keeps its own unchanged layout — the full-size
  // panel, with an environment (Risky Business's Criminal Enterprise) beside it. More than one villain switches to
  // a row of compact panels instead: four of the wide panel wouldn't fit any layout this board runs at, and before
  // this the board only ever built `model.villain` (the active one) at all — Thunderball, Piledriver and Bulldozer
  // were in play with nothing drawn for them.
  const villainAreaBottom = model.villains.length > 1 ? drawVillainRow(ctx, rect, model) : drawSingleVillain(ctx, rect, model);

  const minionTop = villainAreaBottom + 8;
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

/** One villain in play: the full-size panel, with any environment beside it. Returns the band's bottom edge. */
function drawSingleVillain(ctx: BoardDrawContext, rect: Rect, model: BoardModel): number {
  const villainRect: Rect = { x: rect.x + 10, y: rect.y + 10, width: Math.min(280, rect.width - 20), height: 128 };
  drawCharacter(ctx, villainRect, model.villain);

  // The environment sits beside the villain, in the space to the right of its panel. It belongs next to him
  // rather than down with the minions because in the one scenario that has one it *is* the villain's health bar:
  // Norman Osborn cannot be damaged, and the infamy counters on Criminal Enterprise are what you are actually
  // reducing when you attack him.
  const envLeft = villainRect.x + villainRect.width + 10;
  const envRoom = rect.x + rect.width - 10 - envLeft;
  // Laid out wider than a card's own 2.5:3.5, unlike every other tile on the table. At card proportions a
  // 128px-tall tile is 91px wide, and "2 MADNESS" does not fit in that: the count truncated to "2 MADNE…",
  // which is the one thing on this card a player has to be able to read.
  const envWidth = Math.min(170, Math.max(110, (envRoom - 8 * (model.environments.length - 1)) / Math.max(1, model.environments.length)));
  if (model.environments.length > 0 && envRoom >= envWidth) {
    model.environments.forEach((environment, index) => {
      const slot: Rect = { x: envLeft + index * (envWidth + 8), y: villainRect.y, width: envWidth, height: villainRect.height };
      if (slot.x + slot.width <= rect.x + rect.width - 10) drawEnvironment(ctx, slot, environment);
    });
  }
  return villainRect.y + villainRect.height;
}

/**
 * More than one villain in play (The Wrecking Crew's Breakout): a row of compact panels, wrapping into more than
 * one row rather than shrinking below `villainRowSlots`' floor. An environment (no multi-villain scenario has one
 * today) goes in its own strip under the row — there's no "beside" once the row already spans the band.
 * Returns the whole band's bottom edge, environment strip included.
 */
function drawVillainRow(ctx: BoardDrawContext, rect: Rect, model: BoardModel): number {
  const bandHeight = Math.min(128, Math.max(64, Math.round(rect.height * 0.42)));
  const bandRect: Rect = { x: rect.x + 10, y: rect.y + 10, width: rect.width - 20, height: bandHeight };
  const slots = villainRowSlots(bandRect, model.villains.length);
  model.villains.forEach((villain, index) => {
    const slot = slots[index];
    if (slot) drawCompactVillain(ctx, slot, villain);
  });
  let bottom = Math.max(bandRect.y + bandRect.height, ...slots.map((slot) => slot.y + slot.height));

  if (model.environments.length > 0) {
    const envRect: Rect = { x: rect.x + 10, y: bottom + 8, width: rect.width - 20, height: 60 };
    const envWidth = Math.min(170, Math.max(110, (envRect.width - 8 * (model.environments.length - 1)) / model.environments.length));
    model.environments.forEach((environment, index) => {
      const slot: Rect = { x: envRect.x + index * (envWidth + 8), y: envRect.y, width: envWidth, height: envRect.height };
      if (slot.x + slot.width <= envRect.x + envRect.width) drawEnvironment(ctx, slot, environment);
    });
    bottom = envRect.y + envRect.height;
  }
  return bottom;
}

/**
 * One villain's compact panel: a thumbnail, its name and stage, ATK/SCH as plain numbers (no room here for the
 * full starburst badges the single-villain panel uses), a thin HP bar, and — the design's rule that a status can
 * never be colour alone — an explicit "ACTIVE" text tag rather than a highlight border, and a struck "DEFEATED"
 * slot rather than just a dimmed one.
 *
 * Registered as a tap target and hit rect exactly like any other card (`ctx.makeTapTarget`/`ctx.frame.hitRects`),
 * so targeting a non-active villain with a basic attack, keyboard/gamepad focus order, and long-press Inspect all
 * just work the way they already do for the single-villain panel — nothing about *how* a card answers a tap changes
 * here, only how it's drawn.
 */
function drawCompactVillain(ctx: BoardDrawContext, rect: Rect, villain: VillainPanel): void {
  const { scene, controller } = ctx;
  const panel = villain.panel;
  ctx.frame.hitRects.set(panel.instanceId, rect);

  if (villain.defeated) {
    drawDefeatedVillainSlot(scene, rect, panel.name);
    ctx.makeTapTarget(rect, panel.instanceId, () => ctx.inspect(panel.instanceId));
    return;
  }

  const dim = dimAlpha(controller.selection, panel.instanceId);
  const g = scene.add.graphics();
  paintPanel(g, rect, "card", targetState(controller.selection, panel.instanceId));

  const artWidth = rect.width >= 96 ? Math.round(Math.min(rect.width * 0.36, rect.height - 6)) : 0;
  const textLeft = rect.x + 4 + (artWidth > 0 ? artWidth + 5 : 0);
  const textWidth = Math.max(24, rect.x + rect.width - 4 - textLeft);
  if (artWidth > 0) {
    const artRect: Rect = { x: rect.x + 3, y: rect.y + 3, width: artWidth, height: rect.height - 6 };
    const frame = scene.add.graphics();
    frame.fillStyle(surface.parchment.hex, dim).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
    drawArt(scene, ctx.art.request(scene, panel.art), artRect, { fit: "cover", alpha: dim });
  }

  let top = rect.y + 3;
  fitText(
    scene.add
      .text(textLeft, top, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
      .setWordWrapWidth(textWidth)
      .setMaxLines(2),
    textWidth,
    typeRole.rowTitle.size,
  );
  top += 14;

  if (rect.height >= 76) {
    fitText(label(scene, textLeft, top, panel.subtitle, typeRole.label, surface.ink.hex, ink.label * dim), textWidth, typeRole.label.size);
    top += 12;
  }

  // The one marker the design calls out as text, never colour alone: a pulsing ring or a tinted border reads fine
  // for sighted players but says nothing to anyone relying on shape or a screen reader.
  if (villain.active) {
    const chip: Rect = { x: textLeft, y: top, width: Math.min(textWidth, 54), height: 14 };
    const cg = scene.add.graphics();
    cg.fillStyle(signal.heal.hex, dim).fillRect(chip.x, chip.y, chip.width, chip.height);
    scene.add
      .text(chip.x + chip.width / 2, chip.y + chip.height / 2, "ACTIVE", { ...textStyle(typeRole.label, surface.paper.hex, dim), fontSize: "9px" })
      .setOrigin(0.5)
      .setLetterSpacing(0.6);
    top += 17;
  }

  const statLine = panel.stats
    .filter((tile) => tile.label !== "HP")
    .map((tile) => `${tile.label} ${tile.value}`)
    .join("  ");
  if (statLine && rect.height - (top - rect.y) >= 24) {
    fitText(label(scene, textLeft, top, statLine, typeRole.label, surface.ink.hex, ink.body * dim), textWidth, typeRole.label.size);
  }

  // A thin HP bar pinned to the foot, the compact panel's stand-in for the full panel's `McHpPlate`.
  if (panel.hp) {
    const barHeight = 7;
    const barRect: Rect = { x: rect.x + 4, y: rect.y + rect.height - barHeight - 3, width: rect.width - 8, height: barHeight };
    const ratio = panel.hp.max > 0 ? Math.max(0, Math.min(1, panel.hp.current / panel.hp.max)) : 0;
    const bar = scene.add.graphics();
    bar.fillStyle(surface.parchment.hex, dim).fillRect(barRect.x, barRect.y, barRect.width, barRect.height);
    // `signal.heal` fills proportional to *remaining* HP, matching `McHpPlate`'s own meter — the same "how much is
    // left" reading, just in a strip thin enough to fit a compact panel's foot.
    bar.fillStyle(signal.heal.hex, dim).fillRect(barRect.x, barRect.y, barRect.width * ratio, barRect.height);
    bar.lineStyle(1.5, surface.ink.hex, dim).strokeRect(barRect.x, barRect.y, barRect.width, barRect.height);
    scene.add
      .text(barRect.x + barRect.width / 2, barRect.y - 7, `${panel.hp.current}/${panel.hp.max}`, { ...textStyle(typeRole.label, surface.ink.hex, dim), fontSize: "9px" })
      .setOrigin(0.5, 1);
  }

  ctx.makeTapTarget(rect, panel.instanceId, () => controller.onCharacterTap(panel.instanceId));
}

/**
 * A defeated villain's slot: an ink tile hatched in Hero Red, its name struck through, "DEFEATED" stamped across —
 * the same treatment `drawEliminatedSeat` gives a fallen hero, so the table has one visual language for "still
 * shown, no longer active" rather than two. Still tappable (Inspect), so its stage and text stay readable.
 */
function drawDefeatedVillainSlot(scene: Phaser.Scene, rect: Rect, name: string): void {
  const rg = scene.add.graphics();
  rg.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  hatchRect(rg, rect, accent.heroRed.hex, 0.3, 10, 3);
  rg.lineStyle(2, accent.heroRed.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);

  const label_ = scene.add
    .text(rect.x + 5, rect.y + 5, name, textStyle(typeRole.rowTitle, surface.paper.hex, 0.6))
    .setWordWrapWidth(rect.width - 10)
    .setMaxLines(2);
  fitText(label_, rect.width - 10, typeRole.rowTitle.size);
  rg.lineStyle(2, surface.paper.hex, 0.8).lineBetween(label_.x - 1, label_.y + label_.height / 2, label_.x + label_.width + 1, label_.y + label_.height / 2);

  const stamp = scene.add
    .text(rect.x + rect.width / 2, rect.y + rect.height - 14, "DEFEATED", {
      ...textStyle(typeRole.label, accent.heroRed.hex),
      stroke: cssOf(surface.ink.hex),
      strokeThickness: 2,
      fontSize: "10px",
    })
    .setOrigin(0.5)
    .setLetterSpacing(1);
  fitText(stamp, rect.width - 8, 10);
}

/**
 * One environment card: its scan, its name, and its counters.
 *
 * The counters are the loud part. "If there are no infamy counters here, flip Norman Osborn" makes them the
 * scenario's only visible progress, and a player attacking a villain who takes no damage needs to see the number
 * that *is* moving — otherwise the attack looks like it did nothing at all.
 */
function drawEnvironment(ctx: BoardDrawContext, rect: Rect, environment: EnvironmentPanel): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, rect, "card", targetState(ctx.controller.selection, environment.instanceId));
  const dim = dimAlpha(ctx.controller.selection, environment.instanceId);
  ctx.frame.hitRects.set(environment.instanceId, rect);

  const inner: Rect = { x: rect.x + 3, y: rect.y + 3, width: rect.width - 6, height: rect.height - 6 };
  const drawn = drawArt(scene, ctx.art.request(scene, environment.art), inner, { fit: "cover", alpha: dim }) !== null;

  // Over the art, so the name stays readable whether or not a scan loaded.
  const titleBox: Rect = { x: inner.x, y: inner.y, width: inner.width, height: 30 };
  if (drawn) {
    const wash = scene.add.graphics();
    wash.fillStyle(surface.ink.hex, 0.78 * dim).fillRect(titleBox.x, titleBox.y, titleBox.width, titleBox.height);
  }
  const onArt = drawn ? surface.paper.hex : surface.ink.hex;
  fitText(
    scene.add.text(titleBox.x + 6, titleBox.y + 3, environment.name, textStyle(typeRole.rowTitle, onArt, dim)),
    titleBox.width - 12,
    typeRole.rowTitle.size,
  );
  label(scene, titleBox.x + 6, titleBox.y + 18, environment.subtitle, typeRole.label, onArt, ink.label * dim);

  // Each counter kind as its own chip along the bottom: the number big, the kind spelled out beside it, so
  // "4 INFAMY" never has to be inferred from a colour or a pip count.
  const chipHeight = 24;
  environment.counters.slice(0, 2).forEach((counter, index) => {
    const chip: Rect = {
      x: inner.x + 4,
      y: inner.y + inner.height - 4 - chipHeight * (index + 1) - index * 3,
      width: inner.width - 8,
      height: chipHeight,
    };
    const cg = scene.add.graphics();
    cg.fillStyle(surface.ink.hex, 0.88 * dim).fillRect(chip.x, chip.y, chip.width, chip.height);
    cg.fillStyle(signal.caution.hex, dim).fillRect(chip.x, chip.y, 3, chip.height);
    const count = scene.add
      .text(chip.x + 9, chip.y + chip.height / 2, String(counter.count), textStyle(typeRole.stat, signal.caution.hex, dim))
      .setOrigin(0, 0.5);
    fitText(
      label(scene, chip.x + 11 + count.width, chip.y + chip.height / 2, counter.name, typeRole.label, surface.paper.hex, ink.body * dim).setOrigin(0, 0.5),
      chip.width - 18 - count.width,
      typeRole.label.size,
    );
  });
  if (environment.counters.length === 0) {
    label(scene, inner.x + 6, inner.y + inner.height - 18, "no counters", typeRole.label, onArt, ink.meta * dim);
  }

  ctx.makeTapTarget(rect, environment.instanceId, () => ctx.inspect(environment.instanceId));
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
  const piles: readonly { kind: "encounterDeck" | "encounterDiscard"; name: string; count: number; y: number; art: ArtSource | null; instanceId: InstanceId | null }[] = [
    { kind: "encounterDeck", name: "ENC DECK", count: model.encounterPiles.deck, y: rect.y, art: CARD_BACKS.encounter, instanceId: model.encounterDeckTopInstanceId },
    { kind: "encounterDiscard", name: "DISCARD", count: model.encounterPiles.discard, y: rect.y + half + 6, art: model.encounterDiscardTop, instanceId: model.encounterDiscardTopInstanceId },
  ];
  for (const { kind, name, count, y, art, instanceId } of piles) {
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

    // Every pile with a card in it is readable, the deck's own facedown top included (D08's own subtitle: "any
    // card, anywhere, including facedown counts") — Inspect already draws the honest "facedown" face for it via
    // `faceVisible`; this box only had no tap target to reach that with.
    if (count > 0 && instanceId) {
      ctx.frame.hitRects.set(instanceId, box);
      addTapTarget(scene, box, { onTap: () => ctx.inspect(instanceId), onInspect: () => ctx.inspect(instanceId) });
    }
  }
}

export function drawPlayArea(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, rect, "rail", "rest");
  label(scene, rect.x + 8, rect.y + 6, "your play area", typeRole.label, surface.ink.hex, ink.label);

  // A second deck the identity brings (Doctor Strange's Invocation deck) gets
  // its own column beside the play area, the way the encounter piles sit
  // beside the enemies — present only for the one identity that has one, so
  // every other hero's play area is unchanged (PLAN.md Phase 7: "the board
  // has no Invocation deck; the client never mentions `separateDeck`").
  const hasSeparateDecks = model.separateDecks.length > 0;
  const separateWidth = hasSeparateDecks ? Math.min(150, Math.max(96, rect.width * 0.26)) : 0;
  const gap = hasSeparateDecks ? 8 : 0;
  const inner: Rect = { x: rect.x + 8, y: rect.y + 22, width: rect.width - 16 - separateWidth - gap, height: rect.height - 30 };
  if (hasSeparateDecks) {
    const separateRect: Rect = { x: inner.x + inner.width + gap, y: inner.y, width: separateWidth, height: inner.height };
    drawSeparateDecks(ctx, separateRect, model.separateDecks, model.perspectiveId);
  }

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

/**
 * A second deck the identity brings besides its player deck — Doctor
 * Strange's Invocation deck, one column per deck (today, always exactly
 * one). Two boxes stacked: the deck itself, faceup on top the way its own
 * printed rule keeps it (`topCardFaceup`) and readable by the same tap-hold/
 * right-click Inspect every other card answers to; and the deck's *own*
 * discard pile, apart from the player's — open information, like every
 * discard pile, so it shows its own top card too.
 */
function drawSeparateDecks(ctx: BoardDrawContext, rect: Rect, decks: readonly SeparateDeckPile[], perspectiveId: PlayerId): void {
  const { scene } = ctx;
  const rowHeight = Math.min(120, Math.max(70, (rect.height - (decks.length - 1) * 8) / Math.max(1, decks.length)));
  decks.forEach((deck, index) => {
    const row: Rect = { x: rect.x, y: rect.y + index * (rowHeight + 8), width: rect.width, height: rowHeight };
    if (row.y + row.height > rect.y + rect.height) return;
    label(scene, row.x, row.y, deck.name, typeRole.label, surface.ink.hex, ink.label);
    const boxTop = row.y + 14;
    const boxHeight = row.height - 14;
    if (boxHeight < 30) return;
    const boxWidth = (row.width - 6) / 2;
    const deckBox: Rect = { x: row.x, y: boxTop, width: boxWidth, height: boxHeight };
    const discardBox: Rect = { x: row.x + boxWidth + 6, y: boxTop, width: boxWidth, height: boxHeight };

    drawPile(ctx, deckBox, "deck", deck.deckCount, deck.topArt);
    drawPile(ctx, discardBox, "disc.", deck.discardCount, deck.discardTopArt);
    ctx.frame.pileRects.set(pileKey("separateDeck", perspectiveId, deck.name), deckBox);
    ctx.frame.pileRects.set(pileKey("separateDiscard", perspectiveId, deck.name), discardBox);

    // The deck's top card is the point of it — Master of the Mystic Arts
    // (`09005`) and Spell Mastery (`09001a`) both read it directly — so it is
    // both a target the board highlights during that ability and a card the
    // player can always stop to read, the same as any other faceup card.
    if (deck.topInstanceId) {
      const top = deck.topInstanceId;
      ctx.frame.hitRects.set(top, deckBox);
      addTapTarget(scene, deckBox, { onTap: () => ctx.inspect(top), onInspect: () => ctx.inspect(top) });
    }
    if (deck.discardTopInstanceId) {
      const top = deck.discardTopInstanceId;
      // Also a beat anchor (`view/beats.ts`'s `abilityResolved` case): an Invocation card that just resolved its
      // Special and moved to this deck's own discard (Spell Mastery, Natural Talent) needs a rect here to land its
      // beat on — without it, "resolve → discard" was a state change with nowhere on screen to point at.
      ctx.frame.hitRects.set(top, discardBox);
      addTapTarget(scene, discardBox, { onTap: () => ctx.inspect(top), onInspect: () => ctx.inspect(top) });
    }
  });
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
