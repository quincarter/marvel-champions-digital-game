/**
 * The Board's remaining table zones: enemies, the encounter piles, your play
 * area and the other heroes' seats. The game log is `log.ts`.
 */

import { drawTeamUpBlurb, drawTeamUpRing } from "./team-up-badge.js";
import { ringDiameterFor, rowRings } from "../../view/team-up-layout.js";
import type Phaser from "phaser";
import type { InstanceId, PlayerId } from "@mc/engine";
import { drawArt } from "../../art/card-art.js";
import { CARD_BACKS, type ArtSource } from "../../art/art-source.js";
import { accent, ink, signal, status, surface, typeRole } from "../../tokens.js";
import { cssOf, skin, textStyle } from "../../ui/theme.js";
import { appSession } from "../../session.js";
import { McButton, fitText, fitTight, fitWrapped, hatchRect, label, paintPanel } from "../../ui/widgets.js";
import type {
  BoardModel,
  CharacterPanel,
  EnvironmentPanel,
  FormCardGroup,
  ScenarioDeckPanel,
  SetAsidePanel,
  SeatRow,
  SeparateDeckPile,
  VillainPanel,
} from "../../view/board-model.js";
import { hpFraction, hpRatio } from "../../view/hp-format.js";
import {
  bindStageWords,
  villainRowPlan,
  villainRowSlotsFor,
  villainTileLayout,
} from "../../view/villain-tile-layout.js";
import {
  CARD_ASPECT,
  PANEL_TEXT_INSETS,
  PANEL_TEXT_MIN_WIDTH,
  cardRow,
  minionSlots,
  type Rect,
} from "../../view/layout.js";
import { drawCharacter, drawFootStrip, type DrawCharacterOptions, type LeadChip } from "./character-panel.js";
import { villainPanelPlan } from "../../view/villain-panel-layout.js";
import { drawScheme } from "./schemes.js";
import { missionSlots, neutralRow, neutralStack } from "../../view/mission-area-layout.js";
import type { ReferenceCardView } from "../../view/reference-cards.js";
import {
  compactVillainNote,
  counterNote,
  scenarioAreaTag,
  type ScenarioPlayAreaPanel,
} from "../../view/board-model.js";
import { FOOT_STRIP_HEIGHT, footStripLayout } from "../../view/foot-strip-layout.js";
import {
  CHIP_GAP,
  CHIP_MAX_LINES,
  CHIP_PAD,
  CHIP_TEXT_PAD,
  settleChipRoom,
  engagedChipRows,
} from "../../view/engaged-chips.js";
import {
  ENVIRONMENT_MIN_WIDTH,
  type CompactEnvironmentLayout,
  tuckedFanLayout,
  minionRoomBesideEnvironments,
  MINION_BESIDE_TILE_MAX,
  environmentCompactLayout,
  environmentSlots,
  environmentStripRoom,
  isCompactEnvironment,
} from "../../view/environment-layout.js";
import { POOL_DEPS } from "../../content/pool.js";
import { otherSeatAbilityCards, type OtherSeatAbilityCard } from "../../view/other-seat-abilities.js";
import { seatLineOffsets, teamLayout, type TeamLayout } from "../../view/team-layout.js";
import {
  encounterPileSlots,
  pileChipsOf,
  setAsideLines,
  shortPileName,
  shownTopChipsOf,
} from "../../view/encounter-pile-layout.js";
import { bandHeightWithMinions, MINION_ROW_MIN_HEIGHT } from "../../view/enemies-band.js";
import { pileKey, type BoardDrawContext } from "./context.js";
import { drawPile } from "./piles.js";
import { drawDealtPile } from "./dealt-pile.js";
import { dealtPileParts, dealtWords } from "../../view/dealt-pile.js";
import { addTapTarget } from "./tap-target.js";
import { dimAlpha, focusKey, targetState } from "./selection.js";
import {
  formStackLayout,
  formColumnWidth,
  playAreaRow,
  separateColumnWidth,
  separatePileBoxes,
  separateRowHeight,
  sliceWithin,
} from "../../view/play-area-row.js";
import { setMask } from "../../ui/rex.js";
import { clipToViewport } from "../../ui/scroll-clip.js";
import { bindDragSurface } from "../../ui/hold-target.js";
import { onTap } from "../../ui/tap.js";

export function drawEnemies(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const g = ctx.scene.add.graphics();
  paintPanel(g, rect, "card", "rest");

  // A single villain is every scenario before The Wrecking Crew, and keeps its own unchanged layout — the full-size
  // panel, with an environment (Risky Business's Criminal Enterprise) beside it. More than one villain switches to
  // a row of compact panels instead: four of the wide panel wouldn't fit any layout this board runs at, and before
  // this the board only ever built `model.villain` (the active one) at all — Thunderball, Piledriver and Bulldozer
  // were in play with nothing drawn for them.
  let beside: Rect | null = null;
  let villainAreaBottom: number;
  // Two or three villains are drawn as full panels, as a lone villain is, when they fit at a readable size; many
  // villains (or a short table) keep the compact tile row.
  const panels = model.villains.length > 1 ? drawVillainPanels(ctx, rect, model) : null;
  if (panels) {
    villainAreaBottom = panels.bottom;
    beside = panels.minionsBeside;
  } else if (model.villains.length > 1) villainAreaBottom = drawVillainRow(ctx, rect, model);
  else {
    const single = drawSingleVillain(ctx, rect, model);
    villainAreaBottom = single.bottom;
    beside = single.minionsBeside;
  }

  // A short zone with one villain has no room under it for a readable minion row (`view/enemies-band.ts`), so the
  // minions take the empty space beside the villain instead of shrinking to a sliver or not being drawn at all.
  // A keyword tag a tile had no room for under its art rides on the chip above it (`drawEngagedChip`).
  const dropped = new Map<InstanceId, string>();
  const minionOptions = (minion: CharacterPanel): DrawCharacterOptions => ({
    onTagDropped: (tag) => dropped.set(minion.instanceId, tag),
  });
  // Chips hang above their tiles ("held", "guard off", "vs Spider-Man"), so a row that carries any reserves the room
  // for the tallest stack: it is measured on the tile width the row would have without it, then laid out below it.
  const roughArea: Rect = {
    x: rect.x + 10,
    y: villainAreaBottom + 8,
    width: rect.width - 20,
    height: Math.max(0, rect.y + rect.height - villainAreaBottom - 18),
  };
  const tileWidthAt = (rowHeight: number): number =>
    model.minions.length > 0 && rowHeight > 40
      ? (cardRow({ ...roughArea, height: rowHeight }, model.minions.length, { gap: 8, maxHeight: rowHeight })[0]
          ?.width ?? 80)
      : 80;
  const { room: chipRoom, maxRows: chipRows } = settleChipRoom(model.minions, roughArea.height, tileWidthAt);
  const minionTop = villainAreaBottom + Math.max(8, chipRoom);
  const minionArea: Rect = {
    x: rect.x + 10,
    y: minionTop,
    width: rect.width - 20,
    height: Math.max(0, rect.y + rect.height - minionTop - 10),
  };
  if (beside) beside = { ...beside, y: beside.y + chipRoom, height: Math.max(0, beside.height - chipRoom) };
  if (beside && model.minions.length > 0) {
    // Beside the villain only when that gives bigger cards than the sliver under it (many minions crowd the narrow
    // space beside it, and the row under the villain is the full width).
    const sideSlots = cardRow(
      { ...beside, height: Math.min(beside.height, MINION_BESIDE_TILE_MAX) },
      model.minions.length,
      { gap: 8, align: "start" },
    );
    const belowSlots =
      minionArea.height > 40 ? cardRow(minionArea, model.minions.length, { gap: 8, maxHeight: minionArea.height }) : [];
    if (belowSlots.length === 0 || sideSlots[0]!.height > belowSlots[0]!.height) {
      model.minions.forEach((minion, index) => drawCharacter(ctx, sideSlots[index]!, minion, minionOptions(minion)));
      // After every tile, so a chip wider than its own tile is never covered by the next one.
      model.minions.forEach((minion, index) =>
        drawEngagedChip(ctx, sideSlots[index]!, minion, dropped.get(minion.instanceId), chipRows),
      );
      return;
    }
  }
  if (model.minions.length > 0 && minionArea.height > 40) {
    const slots = minionSlots(minionArea, model.minions.length, ctx.cardScale, 8, Math.max(0, chipRoom - 8));
    model.minions.forEach((minion, index) => drawCharacter(ctx, slots[index]!, minion, minionOptions(minion)));
    model.minions.forEach((minion, index) =>
      drawEngagedChip(ctx, slots[index]!, minion, dropped.get(minion.instanceId), chipRows),
    );
  }
}

/**
 * "VS SPIDER-MAN": who a minion is engaged with, hung over its top edge, drawn only when more than one seat plays
 * (`CharacterPanel.engagedName` is null otherwise). Words on ink, never a seat color alone.
 */
function drawEngagedChip(
  ctx: BoardDrawContext,
  rect: Rect,
  minion: CharacterPanel,
  tag?: string,
  maxRows = Infinity,
): void {
  // A character a card holds (Thunderbolt Backup's minion, M.O.D.O.K.'s hostage) is engaged with nobody. Its chip says
  // "held" or "captive" and stays inside its own tile's width, so it is never mistaken for the neighbor's; the holder's
  // name is in Inspect. The caution bar the board uses for "something is under or on this" marks it, never color alone.
  // More rows when a tile has no room for them under its art: a keyword that is off while held ("guard off", dimmed),
  // and the keyword tag the stat badges left no strip for ("villainous", on a hero in play as a minion). The whole stack
  // sits above the tile (`view/engaged-chips.ts`: the row reserved the headroom), and a bounded row wraps, never cut.
  // The keyword tag is one word or two ("villainous"): it may be wider than a small tile, centered over it, rather
  // than broken or cut.
  // With the stack held to its primary chip (a short zone), the keyword tag only rides on a tile that has no chip of its
  // own: a second row would run past the headroom the row reserved.
  const own = engagedChipRows(minion, maxRows, rect.width);
  const keepsTag = maxRows === Infinity || own.length < maxRows;
  const rows = [
    ...own.map((row, index) => ({ ...row, alpha: index === 0 ? 1 : ink.meta + 0.3 })),
    ...(tag && keepsTag ? [{ words: tag, bounded: false, bar: 0, alpha: 1 }] : []),
  ];
  const { scene } = ctx;
  let bottom = rect.y - CHIP_GAP;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    const text = label(scene, 0, 0, row.words, typeRole.label, surface.paper.hex, row.alpha);
    // A small tile gets an engaged chip wider than itself (centered over it) rather than a clipped name; the rows that
    // say something about this tile never leave it.
    const room = row.bounded ? rect.width - 4 - row.bar - CHIP_TEXT_PAD : Math.max(88, rect.width - 14);
    // A bounded row stays on one line when it fits whole once the font has stepped down and the tracking is off; only
    // then does it wrap onto a second line (`chipLinesFor` reserved the same).
    const whole = text.text;
    fitTight(text, room, typeRole.label.size);
    if (row.bounded && text.text !== whole) {
      text.setText(whole).setLetterSpacing(typeRole.label.letterSpacing).setFontSize(typeRole.label.size);
      fitWrapped(text, room, CHIP_MAX_LINES, typeRole.label.size);
    }
    const height = Math.ceil(text.height) + CHIP_PAD;
    const width = row.bounded ? rect.width - 4 : Math.ceil(text.width) + 10;
    const chip: Rect = {
      x: rect.x + (row.bounded ? 2 : Math.min(2, (rect.width - width) / 2)),
      y: bottom - height,
      width,
      height,
    };
    bottom = chip.y - CHIP_GAP;
    const g = scene.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
    g.lineStyle(1, surface.paper.hex, 0.6).strokeRect(chip.x, chip.y, chip.width, chip.height);
    if (row.bar > 0) g.fillStyle(signal.caution.hex, row.alpha).fillRect(chip.x, chip.y, row.bar, chip.height);
    // The chip's own fill goes under its text: the text was created first, so it is raised above the fill.
    scene.children.bringToTop(text);
    text.setPosition(chip.x + CHIP_TEXT_PAD / 2 + row.bar, chip.y + (chip.height - text.height) / 2);
  }
}

/** The room a minion row needs under the villain band before the band is allowed to grow into it. */
const MINION_ROW_RESERVE = 8 + 118;
/** The least width beside the villain worth seating minions in: one card at the band's height. */
const MINION_BESIDE_MIN_WIDTH = 90;
/** How tall the single villain's panel may grow on a long table; past this the card stops being a panel and starts being the whole band. */
const VILLAIN_PANEL_MAX_HEIGHT = 260;
/** The same ceiling for the multi-villain compact row. */
const VILLAIN_ROW_MAX_HEIGHT = 220;

/**
 * How tall the villain band gets. The fixed 128px was drawn for a 1440×900 table; an ultrawide's 285px enemies
 * zone held it and 150px of nothing, with the villain's card a thumbnail (owner, 2026-09-21: "the villain ... could
 * be a different kind of view on desktop, especially ultrawides, so you can see their card content better"). On a
 * long table the band now takes a share of the zone's height, leaving a minion row's worth of room under it only
 * when there are minions to seat there, and never past `max`. The phone's tabbed board keeps the fixed height: its
 * enemies tab is a list, not a table.
 */
function villainBandHeight(
  ctx: BoardDrawContext,
  rect: Rect,
  model: BoardModel,
  unsqueezed: number,
  max: number,
  floor: number,
  below = 0,
  growTabbed = false,
): number {
  // A short zone gives the band's height back before the minion row loses its own (`view/enemies-band.ts`).
  const base = bandHeightWithMinions(rect.height, unsqueezed, floor, model.minions.length);
  if (ctx.tabbed && !growTabbed) return base;
  const reserve = model.minions.length > 0 ? MINION_ROW_RESERVE : 0;
  const share = Math.round(rect.height * (model.minions.length > 0 ? 0.5 : 0.75));
  return Math.max(base, Math.min(share, rect.height - 20 - reserve - below, max));
}

/** One villain in play: the full-size panel, with any environment beside it. Returns the band's bottom edge. */
function drawSingleVillain(
  ctx: BoardDrawContext,
  rect: Rect,
  model: BoardModel,
): { readonly bottom: number; readonly minionsBeside: Rect | null } {
  // The wide panel's stats and HP plate are laid out for its full height, so this band never gives any back.
  const villainHeight = villainBandHeight(ctx, rect, model, 128, VILLAIN_PANEL_MAX_HEIGHT, 128);
  // Wide enough for the card at the panel's full height *and* the text column beside it (`drawCharacter`'s own
  // "wide" shape), so a taller panel shows a bigger card rather than the same card with more paper around it.
  const villainWidth = Math.min(
    rect.width - 20,
    Math.max(280, Math.round((villainHeight - 6) * CARD_ASPECT) + PANEL_TEXT_MIN_WIDTH + PANEL_TEXT_INSETS + 60),
  );
  const villainRect: Rect = { x: rect.x + 10, y: rect.y + 10, width: villainWidth, height: villainHeight };
  // No panel when no villain is in play (Shadow Labyrinth, chosen villain gone from the game): the band stays, empty.
  if (model.villain) drawCharacter(ctx, villainRect, model.villain);
  else {
    // A short caption so the empty band reads as a state, not a board that failed to draw.
    ctx.scene.add
      .text(villainRect.x + 8, villainRect.y + 8, "No villain in play", textStyle(typeRole.label, surface.ink.hex, 0.7))
      .setOrigin(0, 0);
  }

  // The environment sits beside the villain, in the space to the right of its panel. It belongs next to him
  // rather than down with the minions because in the one scenario that has one it *is* the villain's health bar:
  // Norman Osborn cannot be damaged, and the infamy counters on Criminal Enterprise are what you are actually
  // reducing when you attack him.
  const envLeft = villainRect.x + villainRect.width + 10;
  const envRoom = rect.x + rect.width - 10 - envLeft;
  // Tiles are laid out wider than a card's own 2.5:3.5, unlike every other tile on the table: at card proportions a
  // 128px-tall tile is 91px wide, and "2 MADNESS" does not fit in that. Environments that do not fit in one row wrap
  // into more rows and shrink (`view/environment-layout.ts`); none is ever left undrawn.
  if (model.environments.length > 0 && envRoom >= ENVIRONMENT_MIN_WIDTH) {
    const room: Rect = { x: envLeft, y: villainRect.y, width: envRoom, height: villainRect.height };
    const slots = environmentSlots(room, model.environments.length);
    model.environments.forEach((environment, index) => drawEnvironment(ctx, slots[index]!, environment));
    // The space right of the environments is the full zone's height: minions (a held one, Thunderbolt Backup's) take it
    // when that gives bigger tiles than the row under the band (`drawEnemies` compares the two).
    const free =
      model.minions.length > 0 && !ctx.tabbed
        ? minionRoomBesideEnvironments(rect, slots, MINION_BESIDE_MIN_WIDTH)
        : null;
    return { bottom: villainRect.y + villainRect.height, minionsBeside: free };
  }
  // No room beside the villain (the phone's enemies tab gives the panel the whole width): the environments sit in a
  // strip right under it, so MaGog's crowds and their ratings counters are on the table here too.
  if (model.environments.length > 0) {
    return { bottom: drawEnvironmentStrip(ctx, rect, villainRect, model.environments), minionsBeside: null };
  }
  const bottom = villainRect.y + villainRect.height;
  const roomBelow = rect.y + rect.height - (bottom + 8) - 10;
  const besideRoom: Rect = { x: envLeft, y: villainRect.y, width: envRoom, height: villainRect.height };
  const useBeside =
    model.minions.length > 0 &&
    !ctx.tabbed &&
    roomBelow < MINION_ROW_MIN_HEIGHT &&
    besideRoom.width >= MINION_BESIDE_MIN_WIDTH;
  return { bottom, minionsBeside: useBeside ? besideRoom : null };
}

/** Height of one environment tile in the strip under a full-width villain panel. */
const ENVIRONMENT_STRIP_TILE_HEIGHT = 112;

/** Environments in rows under the villain band, as many per row as fit at the tile's 170px ceiling. Returns the strip's bottom edge. */
function drawEnvironmentStrip(
  ctx: BoardDrawContext,
  rect: Rect,
  villainRect: Rect,
  environments: readonly EnvironmentPanel[],
): number {
  const gap = 8;
  const room = rect.width - 20;
  const perRow = Math.max(1, Math.floor((room + gap) / (110 + gap)));
  const tileWidth = Math.min(170, (room - gap * (perRow - 1)) / perRow);
  let bottom = villainRect.y + villainRect.height;
  environments.forEach((environment, index) => {
    const row = Math.floor(index / perRow);
    const slot: Rect = {
      x: rect.x + 10 + (index % perRow) * (tileWidth + gap),
      y: villainRect.y + villainRect.height + gap + row * (ENVIRONMENT_STRIP_TILE_HEIGHT + gap),
      width: tileWidth,
      height: ENVIRONMENT_STRIP_TILE_HEIGHT,
    };
    drawEnvironment(ctx, slot, environment);
    bottom = slot.y + slot.height;
  });
  return bottom;
}

/** The markers a villain among several carries as words (`drawCompactVillain` draws the same ones). */
function villainLeadChips(villain: VillainPanel): LeadChip[] {
  const chips: LeadChip[] = [];
  if (villain.active) chips.push({ words: "ACTIVE", fill: signal.heal.hex, color: surface.paper.hex });
  if (villain.activationOrder !== null)
    chips.push({ words: `ORDER ${villain.activationOrder}`, fill: surface.ink.hex, color: surface.paper.hex });
  if (villain.areaLabel)
    chips.push({ words: villain.areaLabel.toUpperCase(), fill: surface.ink.hex, color: surface.paper.hex });
  return chips;
}

/**
 * Two or three villains as full panels side by side (`view/villain-panel-layout.ts`), each drawn exactly as a lone
 * villain is, with any environment as a card-sized tile beside them. Null when they would not fit at a readable size
 * (or on the phone's tabbed board): the caller draws the compact tile row instead.
 */
function drawVillainPanels(
  ctx: BoardDrawContext,
  rect: Rect,
  model: BoardModel,
): { readonly bottom: number; readonly minionsBeside: Rect | null } | null {
  if (ctx.tabbed) return null;
  const height = villainBandHeight(ctx, rect, model, 128, VILLAIN_PANEL_MAX_HEIGHT, 128);
  const envCount = model.environments.length;
  const band: Rect = { x: rect.x + 10, y: rect.y + 10, width: rect.width - 20, height };
  const reserve = envCount === 0 ? 0 : envCount === 1 ? 160 : 330;
  const plan = villainPanelPlan(band, model.villains.length, height, reserve);
  if (!plan) return null;
  const envLeft = plan.right + 10;
  const envRoom = rect.x + rect.width - 10 - envLeft;
  if (envCount > 0 && envRoom < ENVIRONMENT_MIN_WIDTH) return null;

  model.villains.forEach((villain, index) => {
    const slot = plan.slots[index]!;
    if (villain.defeated) {
      ctx.frame.hitRects.set(villain.panel.instanceId, slot);
      drawDefeatedVillainSlot(ctx.scene, slot, villain.panel.name);
      ctx.makeTapTarget(slot, villain.panel.instanceId, () => ctx.inspect(villain.panel.instanceId));
      return;
    }
    drawCharacter(ctx, slot, villain.panel, { shape: "wide", leadChips: villainLeadChips(villain) });
  });
  const bottom = band.y + plan.tileHeight;
  if (envCount > 0) {
    const slots = environmentSlots({ x: envLeft, y: band.y, width: envRoom, height: plan.tileHeight }, envCount);
    model.environments.forEach((environment, index) => drawEnvironment(ctx, slots[index]!, environment));
    const free = model.minions.length > 0 ? minionRoomBesideEnvironments(rect, slots, MINION_BESIDE_MIN_WIDTH) : null;
    return { bottom, minionsBeside: free };
  }
  const roomBelow = rect.y + rect.height - (bottom + 8) - 10;
  const besideRoom: Rect = { x: envLeft, y: band.y, width: envRoom, height: plan.tileHeight };
  const useBeside = model.minions.length > 0 && roomBelow < MINION_ROW_MIN_HEIGHT && envRoom >= MINION_BESIDE_MIN_WIDTH;
  return { bottom, minionsBeside: useBeside ? besideRoom : null };
}

/**
 * More than one villain in play (The Wrecking Crew's Breakout): a row of compact panels, wrapping into more than
 * one row rather than shrinking below `villainRowSlots`' floor. An environment (no multi-villain scenario has one
 * today) goes in its own strip under the row — there's no "beside" once the row already spans the band.
 * Returns the whole band's bottom edge, environment strip included.
 */
function drawVillainRow(ctx: BoardDrawContext, rect: Rect, model: BoardModel): number {
  // The environment strip under the row (as many rows of tiles as it takes to draw them all) is part of what the
  // band's height has to leave room for, or on a short table it runs out of the zone.
  const stripRoom =
    model.environments.length > 0
      ? environmentStripRoom({ x: rect.x + 10, y: 0 }, rect.width - 20, model.environments.length)
      : null;
  const stripHeight = stripRoom ? stripRoom.height + 8 : 0;
  // Card size grows the row with everything else on the table (the zone is already that much taller).
  const scale = Math.max(1, ctx.cardScale);
  const unsqueezed = Math.min(Math.round(128 * scale), Math.max(64, Math.round(rect.height * 0.42)));
  // A phone's Enemies tab is as tall as the table scrolls, and villains alone fill it (no blank panel to scroll into).
  const fillsTab = ctx.tabbed && scale > 1 && model.minions.length === 0;
  const bandHeight = fillsTab
    ? Math.max(56, rect.height - 20 - stripHeight)
    : villainBandHeight(
        ctx,
        rect,
        model,
        Math.max(56, Math.min(unsqueezed, rect.height - 20 - stripHeight)),
        Math.round(VILLAIN_ROW_MAX_HEIGHT * scale),
        56,
        stripHeight,
        scale > 1,
      );
  // Rows that would be shorter than a tile needs to hold its scan and its words grow into the room under the band,
  // never past what a minion row (when there is one) and the environment strip need.
  const reserve = model.minions.length > 0 ? MINION_ROW_RESERVE : 0;
  const room = Math.max(bandHeight, rect.height - 20 - reserve - stripHeight);
  const plan = villainRowPlan(rect.width - 20, model.villains.length, bandHeight, room);
  const bandRect: Rect = { x: rect.x + 10, y: rect.y + 10, width: rect.width - 20, height: plan.height };
  const slots = villainRowSlotsFor(bandRect, model.villains.length, plan);
  model.villains.forEach((villain, index) => {
    const slot = slots[index];
    if (slot) drawCompactVillain(ctx, slot, villain);
  });
  let bottom = bandRect.y + bandRect.height;

  if (model.environments.length > 0) {
    // Tiles wrap into more rows under the row of villains rather than ever being dropped (`environmentStripRoom`).
    const room: Rect = { ...stripRoom!, y: bottom + 8 };
    const slots = environmentSlots(room, model.environments.length);
    model.environments.forEach((environment, index) => drawEnvironment(ctx, slots[index]!, environment));
    bottom = room.y + room.height;
  }
  return bottom;
}

/** A small word chip (ACTIVE, ORDER 3, VS SPIDER-MAN) in `fill`; returns its width. Words, never a color alone. */
function drawTileChip(
  scene: Phaser.Scene,
  at: { readonly x: number; readonly y: number },
  words: string,
  maxWidth: number,
  fill: number,
  textColor: number,
  dim: number,
): number {
  const text = label(scene, 0, 0, words, typeRole.label, textColor, dim);
  text.setFontSize(9).setLetterSpacing(0.6);
  fitTight(text, maxWidth - 8, 9);
  const width = Math.min(maxWidth, Math.ceil(text.width) + 8);
  const g = scene.add.graphics();
  g.fillStyle(fill, dim).fillRect(at.x, at.y, width, 14);
  scene.children.bringToTop(text);
  text.setPosition(at.x + (width - text.width) / 2, at.y + (14 - text.height) / 2);
  return width;
}

/**
 * One villain's compact tile, art first (`view/villain-tile-layout.ts` decides the shape and the rects): the scan, the
 * name and stage wrapped whole, ATK/SCH as plain numbers, a thin HP bar, and — the design's rule that a status can
 * never be color alone — explicit "ACTIVE", "ORDER n" and "VS <player>" chips rather than a highlight border, and a
 * struck "DEFEATED" slot rather than just a dimmed one.
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

  const tile = villainTileLayout(rect);
  if (tile.art) {
    const frame = scene.add.graphics();
    frame.fillStyle(surface.parchment.hex, dim).fillRect(tile.art.x, tile.art.y, tile.art.width, tile.art.height);
    drawArt(scene, ctx.art.request(scene, panel.art), tile.art, { fit: "cover", alpha: dim });
    frame.lineStyle(1, surface.ink.hex, dim).strokeRect(tile.art.x, tile.art.y, tile.art.width, tile.art.height);
  }

  const textLeft = tile.text.x;
  const textWidth = tile.text.width;
  const bottom = tile.hpLine.y - 1;
  let top = tile.text.y;
  const nameText = scene.add
    .text(textLeft, top, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
    .setWordWrapWidth(textWidth);
  // The name wraps onto a second line (stepping the font down first) rather than ending in an ellipsis.
  fitWrapped(nameText, textWidth, 2, typeRole.rowTitle.size);
  top += Math.max(14, Math.ceil(nameText.height) + 1);

  // "VILLAIN · STAGE II" is wrapped, never cut to "VILLAIN · ST…": the stage is the part the player is reading.
  if (bottom - top >= 24) {
    const subtitle = label(
      scene,
      textLeft,
      top,
      bindStageWords(panel.subtitle),
      typeRole.label,
      surface.ink.hex,
      ink.label * dim,
    );
    fitWrapped(subtitle, textWidth, 2, typeRole.label.size);
    top += Math.max(12, Math.ceil(subtitle.height) + 1);
  }

  // The markers the design calls out as text, never color alone: a pulsing ring or a tinted border reads fine for
  // sighted players but says nothing to anyone relying on shape or a screen reader. They wrap onto a second row.
  const chips: { readonly words: string; readonly fill: number; readonly color: number }[] = [];
  if (villain.active) chips.push({ words: "ACTIVE", fill: signal.heal.hex, color: surface.paper.hex });
  if (villain.activationOrder !== null)
    chips.push({ words: `ORDER ${villain.activationOrder}`, fill: surface.ink.hex, color: surface.paper.hex });
  if (villain.areaLabel)
    chips.push({ words: villain.areaLabel.toUpperCase(), fill: surface.ink.hex, color: surface.paper.hex });
  let chipX = textLeft;
  let chipsDrawn = 0;
  for (const chip of chips) {
    if (top + 14 > bottom) break;
    const wanted = Math.ceil(chip.words.length * 6.4) + 8;
    if (chipX > textLeft && chipX + wanted > textLeft + textWidth) {
      chipX = textLeft;
      top += 17;
      if (top + 14 > bottom) break;
    }
    const width = drawTileChip(
      scene,
      { x: chipX, y: top },
      chip.words,
      textLeft + textWidth - chipX,
      chip.fill,
      chip.color,
      dim,
    );
    chipX += width + 4;
    chipsDrawn += 1;
  }
  if (chipsDrawn > 0) top += 17;

  // A narrow column stacks the numbers ("ATK 2" over "SCH 2") instead of cutting the second one.
  const stats = panel.stats.filter((tile) => tile.label !== "HP").map((tile) => `${tile.label} ${tile.value}`);
  if (stats.length > 0 && bottom - top >= 12) {
    const stacked = textWidth < 120;
    const statText = label(
      scene,
      textLeft,
      top,
      stats.join(stacked ? "\n" : "  "),
      typeRole.label,
      surface.ink.hex,
      ink.body * dim,
    );
    fitWrapped(statText, textWidth, stacked ? stats.length : 1, typeRole.label.size);
    // The note below starts under these lines, not on top of them.
    top += Math.max(12, Math.ceil(statText.height) + 2);
  }

  // Statuses and attachments (War stunned, with a Golden Horse): the compact tile's wrapped form of what the
  // single-villain panel draws as chips, in whatever room is left above the HP line; Inspect has the rest.
  const note = compactVillainNote(panel);
  const noteRoom = bottom - top;
  if (note && noteRoom >= 11) {
    const noteText = label(scene, textLeft, top, note, typeRole.label, surface.ink.hex, ink.body * dim);
    fitWrapped(noteText, textWidth, Math.max(1, Math.min(3, Math.floor(noteRoom / 11))), typeRole.label.size);
  }

  // A thin HP bar pinned to the foot, the compact panel's stand-in for the full panel's `McHpPlate`.
  if (panel.hp) {
    const barRect = tile.bar;
    const ratio = hpRatio(panel.hp.current, panel.hp.max);
    const bar = scene.add.graphics();
    bar.fillStyle(surface.parchment.hex, dim).fillRect(barRect.x, barRect.y, barRect.width, barRect.height);
    // `signal.heal` fills proportional to *remaining* HP, matching `McHpPlate`'s own meter — the same "how much is
    // left" reading, just in a strip thin enough to fit a compact panel's foot.
    bar.fillStyle(signal.heal.hex, dim).fillRect(barRect.x, barRect.y, barRect.width * ratio, barRect.height);
    bar.lineStyle(1.5, surface.ink.hex, dim).strokeRect(barRect.x, barRect.y, barRect.width, barRect.height);
    scene.add
      .text(
        tile.hpLine.x + tile.hpLine.width,
        tile.hpLine.y + tile.hpLine.height,
        hpFraction(panel.hp.current, panel.hp.max),
        { ...textStyle(typeRole.label, surface.ink.hex, dim), fontSize: "10px" },
      )
      .setOrigin(1, 1);
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
  rg.lineStyle(2, surface.paper.hex, 0.8).lineBetween(
    label_.x - 1,
    label_.y + label_.height / 2,
    label_.x + label_.width + 1,
    label_.y + label_.height / 2,
  );

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

/** "0/1" for a counter its card caps, else the bare count. */
const counterFraction = (counter: { readonly count: number; readonly limit?: number }): string =>
  counter.limit === undefined ? String(counter.count) : `${counter.count}/${counter.limit}`;

type EnvironmentCounter = EnvironmentPanel["counters"][number];
/**
 * The threat line ("3/4 THREAT", Alert Level; issue 182) is the number a player watches to stay alive, so its count
 * keeps the full stat size where other "0/1" counts step down.
 */
const isThreatChip = (counter: EnvironmentCounter): boolean => counter.name === "threat";
/** A line that loses the game when reached is striped red, and wider; every other counter keeps the caution stripe. */
const chipStripe = (counter: EnvironmentCounter): number => (counter.danger ? accent.heroRed.hex : signal.caution.hex);
const chipStripeWidth = (counter: EnvironmentCounter): number => (counter.danger ? 5 : 3);

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
  if (isCompactEnvironment(rect)) {
    const layout = drawCompactEnvironmentText(ctx, rect, environment, drawn, dim);
    ctx.makeTapTarget(rect, environment.instanceId, () => ctx.controller.onCharacterTap(environment.instanceId));
    const top = layout.title.y + layout.title.height + 3;
    const bottom = (layout.counters[0]?.y ?? rect.y + rect.height - 3) - 3;
    drawTuckedFan(ctx, { x: inner.x, y: top, width: inner.width, height: bottom - top }, environment, dim);
    return;
  }

  // Over the art, so the name stays readable whether or not a scan loaded. A name that does not fit one row wraps to
  // a second (stepping the font down first) and the band grows to hold it, never "SAVE THE SCH…".
  const onArt = drawn ? surface.paper.hex : surface.ink.hex;
  const nameText = scene.add
    .text(inner.x + 6, inner.y + 3, environment.name, textStyle(typeRole.rowTitle, onArt, dim))
    .setWordWrapWidth(inner.width - 12);
  fitWrapped(nameText, inner.width - 12, 2, typeRole.rowTitle.size);
  // The subtitle carries the tile's damage ("ENVIRONMENT · 1/9 DAMAGE"), so it wraps to a second line and the band grows
  // to hold it, never "1/9 DA…".
  const subtitleText = label(
    scene,
    inner.x + 6,
    inner.y + 3 + Math.ceil(nameText.height),
    environment.subtitle,
    typeRole.label,
    onArt,
    ink.label * dim,
  );
  fitWrapped(subtitleText, inner.width - 12, 2, typeRole.label.size);
  // Each counter kind as its own chip along the bottom: the number big, the kind spelled out beside it, so
  // "4 INFAMY" never has to be inferred from a color or a pip count.
  const chipHeight = 24;
  const counterCount = Math.min(environment.counters.length, 2);
  const countersTop =
    counterCount > 0
      ? inner.y + inner.height - 4 - counterCount * chipHeight - (counterCount - 1) * 3
      : inner.y + inner.height - 22;
  // A short tile with counter chips keeps the subtitle to one line rather than letting the chips paint over it.
  if (subtitleText.y + subtitleText.height > countersTop - 4) {
    fitWrapped(subtitleText, inner.width - 12, 1, typeRole.label.size);
  }
  const titleBox: Rect = {
    x: inner.x,
    y: inner.y,
    width: inner.width,
    height: Math.max(30, Math.ceil(nameText.height) + 3 + Math.max(14, Math.ceil(subtitleText.height) + 2)),
  };
  if (drawn) {
    const wash = scene.add.graphics();
    wash.fillStyle(surface.ink.hex, dim).fillRect(titleBox.x, titleBox.y, titleBox.width, titleBox.height);
    scene.children.bringToTop(nameText);
    scene.children.bringToTop(subtitleText);
  }

  // A printed Hero/Alter-Ego Action or resource ability on the environment itself (Library Labyrinth's "This
  // way?"), the same `▶` affordance a character panel's own foot strip gives its usable ability — drawn only
  // where it fits between the title band and the counter chips.
  const abilityLine = ctx.controller.abilityLine(environment.instanceId);
  const abilityTop = titleBox.y + titleBox.height + 4;
  const wrappedHeight = abilityLine ? footStripLayout(abilityLine, inner.width).height : FOOT_STRIP_HEIGHT;
  const abilityHeight = abilityTop + wrappedHeight <= countersTop - 4 ? wrappedHeight : FOOT_STRIP_HEIGHT;
  if (abilityLine && abilityTop + abilityHeight <= countersTop - 4) {
    drawFootStrip(
      scene,
      { x: inner.x, y: abilityTop, width: inner.width, height: abilityHeight },
      abilityLine,
      "ability",
      dim,
    );
  }

  environment.counters.slice(0, 2).forEach((counter, index) => {
    const chip: Rect = {
      x: inner.x + 4,
      y: inner.y + inner.height - 4 - chipHeight * (index + 1) - index * 3,
      width: inner.width - 8,
      height: chipHeight,
    };
    const cg = scene.add.graphics();
    cg.fillStyle(surface.ink.hex, 0.88 * dim).fillRect(chip.x, chip.y, chip.width, chip.height);
    cg.fillStyle(chipStripe(counter), dim).fillRect(chip.x, chip.y, chipStripeWidth(counter), chip.height);
    const count = scene.add
      .text(
        chip.x + 9,
        chip.y + chip.height / 2,
        counterFraction(counter),
        textStyle(typeRole.stat, signal.caution.hex, dim),
      )
      .setOrigin(0, 0.5);
    // "0/1" is three glyphs: a step smaller keeps the kind's name beside it whole.
    if (counter.limit !== undefined && !isThreatChip(counter))
      count.setFontSize(Math.round(Number.parseFloat(String(count.style.fontSize)) * 0.7));
    fitText(
      label(
        scene,
        chip.x + 11 + count.width,
        chip.y + chip.height / 2,
        counter.name,
        typeRole.label,
        surface.paper.hex,
        ink.body * dim,
      ).setOrigin(0, 0.5),
      chip.width - 18 - count.width,
      typeRole.label.size,
    );
  });
  if (environment.counters.length === 0) {
    label(scene, inner.x + 6, inner.y + inner.height - 18, "no counters", typeRole.label, onArt, ink.meta * dim);
  }

  ctx.makeTapTarget(rect, environment.instanceId, () => ctx.controller.onCharacterTap(environment.instanceId));
  // Whatever is tucked under it, in the free band between the title (or its ability) and the counter chips.
  const fanTop = (abilityLine ? abilityTop + abilityHeight : titleBox.y + titleBox.height) + 4;
  drawTuckedFan(ctx, { x: inner.x, y: fanTop, width: inner.width, height: countersTop - 4 - fanTop }, environment, dim);
}

/**
 * The cards tucked under an environment (Routed's defeated villains; RRG "Tuck", p. 45): a small faceup fan with an
 * "UNDER n" badge. Each card is its own tap target that opens Inspect, stepping through the tucked cards. A card
 * tucked facedown is a card back, never named.
 */
function drawTuckedFan(ctx: BoardDrawContext, room: Rect, environment: EnvironmentPanel, dim: number): void {
  const fan = tuckedFanLayout(room, environment.tuckedCount, CARD_ASPECT);
  if (!fan) return;
  const { scene } = ctx;
  const siblings = environment.tucked.map((card) => card.instanceId);
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 0.9 * dim).fillRect(fan.badge.x, fan.badge.y, fan.badge.width, fan.badge.height);
  g.fillStyle(signal.caution.hex, dim).fillRect(fan.badge.x, fan.badge.y, 3, fan.badge.height);
  const text = scene.add
    .text(
      fan.badge.x + 8,
      fan.badge.y + fan.badge.height / 2,
      `UNDER ${environment.tuckedCount}`,
      textStyle(typeRole.label, surface.paper.hex, dim),
    )
    .setOrigin(0, 0.5);
  fitText(text, fan.badge.width - 10, typeRole.label.size);
  environment.tucked.forEach((card, index) => {
    const rect = fan.cards[index]!;
    const back = scene.add.graphics();
    back.fillStyle(surface.ink.hex, dim).fillRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2);
    back.fillStyle(surface.paper.hex, dim).fillRect(rect.x, rect.y, rect.width, rect.height);
    const art = card.faceup ? card.art : null;
    const drawn = drawArt(scene, ctx.art.request(scene, art), rect, { fit: "cover", alpha: dim }) !== null;
    if (!drawn) {
      const initial = scene.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2, card.faceup ? card.name.charAt(0) : "?", {
          ...textStyle(typeRole.label, surface.ink.hex, dim),
        })
        .setOrigin(0.5);
      scene.children.bringToTop(initial);
    }
    ctx.makeTapTarget(rect, card.instanceId, () => ctx.inspect(card.instanceId, siblings));
  });
}

/**
 * A short tile's text (`environmentCompactLayout`): the name on an ink band over the art and the counters as chips
 * under it, each on its own backing. The subtitle is left out; a usable ability shows as a `▶` tag by the name.
 */
function drawCompactEnvironmentText(
  ctx: BoardDrawContext,
  rect: Rect,
  environment: EnvironmentPanel,
  drawn: boolean,
  dim: number,
): CompactEnvironmentLayout {
  const { scene } = ctx;
  const hasAbility = ctx.controller.abilityLine(environment.instanceId) !== null;
  const counterNames = environment.counters.map((counter) => counter.name);
  let layout = environmentCompactLayout(rect, counterNames, hasAbility);
  const onArt = drawn ? surface.paper.hex : surface.ink.hex;
  // The name wraps onto a second line (the font stepping down first) and the band grows to hold it, never "Chief
  // Surveillance Of…"; only what the counters leave is available to it.
  const name = scene.add
    .text(layout.title.x + 6, layout.title.y, environment.name, textStyle(typeRole.rowTitle, onArt, dim))
    .setOrigin(0, 0);
  fitWrapped(name, layout.title.width - 12, 2, typeRole.rowTitle.size);
  const wanted = Math.ceil(name.height) + 4;
  if (wanted > layout.title.height) layout = environmentCompactLayout(rect, counterNames, hasAbility, wanted);
  if (name.height + 4 > layout.title.height) fitWrapped(name, layout.title.width - 12, 1, typeRole.rowTitle.size);
  name.setPosition(layout.title.x + 6, layout.title.y + Math.max(0, (layout.title.height - name.height) / 2));
  const bg = scene.add.graphics();
  if (drawn)
    bg.fillStyle(surface.ink.hex, dim).fillRect(
      layout.title.x,
      layout.title.y,
      layout.title.width,
      layout.title.height,
    );
  scene.children.bringToTop(name);
  if (layout.ability) {
    bg.fillStyle(surface.ink.hex, 0.92 * dim).fillRect(
      layout.ability.x,
      layout.ability.y,
      layout.ability.width,
      layout.ability.height,
    );
    bg.fillStyle(signal.heal.hex, dim).fillRect(layout.ability.x, layout.ability.y, 3, layout.ability.height);
    scene.add
      .text(
        layout.ability.x + layout.ability.width / 2 + 1,
        layout.ability.y + layout.ability.height / 2,
        "\u25B6",
        textStyle(typeRole.label, surface.paper.hex, dim),
      )
      .setOrigin(0.5);
  }
  environment.counters.slice(0, layout.counters.length).forEach((counter, index) => {
    const chip = layout.counters[index]!;
    bg.fillStyle(surface.ink.hex, 0.9 * dim).fillRect(chip.x, chip.y, chip.width, chip.height);
    bg.fillStyle(chipStripe(counter), dim).fillRect(chip.x, chip.y, chipStripeWidth(counter), chip.height);
    const count = scene.add
      .text(
        chip.x + 8,
        chip.y + chip.height / 2,
        counterFraction(counter),
        textStyle(typeRole.statSmall, signal.caution.hex, dim),
      )
      .setOrigin(0, 0.5);
    // "0/1" is three glyphs: a step smaller keeps the kind's name beside it whole on a short tile.
    if (counter.limit !== undefined && !isThreatChip(counter))
      count.setFontSize(Math.round(Number.parseFloat(String(count.style.fontSize)) * 0.7));
    fitText(
      label(
        scene,
        chip.x + 10 + count.width,
        chip.y + chip.height / 2,
        counter.name,
        typeRole.label,
        surface.paper.hex,
        ink.body * dim,
      ).setOrigin(0, 0.5),
      chip.width - 14 - count.width,
      typeRole.label.size,
    );
  });
  return layout;
}

/**
 * The encounter piles, plus one more tile per scenario area in play (The Collection, docs/phase7-wave3.md §3.14)
 * and a deck-and-discard pair per named scenario deck (the Infinity Stone deck, `GameState.scenarioDecks`,
 * docs/phase7-wave4.md §3.6) — a scenario with none of either draws exactly the two-pile column this was before.
 * The deck (encounter or scenario) is a facedown stack, so it shows the encounter back — the same back every
 * facedown encounter card shows, which is what makes a stack read as a stack rather than as a number in a box.
 * The discard, and a scenario area, are faceup at the table, so each shows its top card; a scenario area's whole
 * contents (not just the top) are then a tap away, the same "◂ ▸ through the rest of the pile" Inspect already
 * gives the discard (`piles.ts`'s own docblock).
 */
export function drawEncounter(
  ctx: BoardDrawContext,
  rect: Rect,
  model: BoardModel,
  setAsideBox: Rect | null = null,
): void {
  const { scene } = ctx;
  type Pile = {
    readonly kind: "encounterDeck" | "encounterDiscard" | "scenarioArea" | "scenarioDeck" | "scenarioDiscard";
    readonly name: string;
    readonly count: number;
    /** What the count chip reads when it is not the bare count: a scenario area's "3/5" against its limit. */
    readonly countLabel?: string;
    readonly art: ArtSource | null;
    readonly instanceId: InstanceId | null;
    /** Every card in the pile, for a tap to open browsable through — only a scenario area needs more than one. */
    readonly siblings: readonly InstanceId[];
    /** A discard pile that fans out on a tap (`ctx.openPile`) names itself here; absent, the tap opens the top card. */
    readonly pileTitle?: string;
  };
  // The pile column is narrow (the same width "ENC DECK"/"DISCARD" are tuned for), so a scenario deck's own
  // printed name ("Infinity Stone") is abbreviated to its last word rather than shown in full — "STONE DECK", not
  // "INFINITY STONE DECK" overlapping the count chip.
  const scenarioDeckPiles = (deck: ScenarioDeckPanel): readonly Pile[] => {
    const short = deck.name.trim().split(/\s+/).at(-1) ?? deck.name;
    return [
      {
        kind: "scenarioDeck",
        name: `${short.toUpperCase()} DECK`,
        count: deck.deckCount,
        art: CARD_BACKS.encounter,
        instanceId: null,
        siblings: [],
      },
      // The show deck has no discard pile: no slot for one, so nothing on the table suggests a card can go there.
      ...(deck.hasDiscard
        ? [
            {
              kind: "scenarioDiscard" as const,
              name: `${short.toUpperCase()} DISCARD`,
              count: deck.discardCount,
              art: deck.discardTopArt,
              instanceId: deck.discardTopInstanceId,
              siblings: deck.discard,
              pileTitle: `${short.charAt(0).toUpperCase()}${short.slice(1)} discard`,
            },
          ]
        : []),
    ];
  };
  const piles: readonly Pile[] = [
    {
      kind: "encounterDeck",
      name: "ENC DECK",
      count: model.encounterPiles.deck,
      art: model.encounterDeckTopArt ?? CARD_BACKS.encounter,
      instanceId: model.encounterDeckTopInstanceId,
      siblings: [],
    },
    {
      kind: "encounterDiscard",
      name: "DISCARD",
      count: model.encounterPiles.discard,
      art: model.encounterDiscardTop,
      instanceId: model.encounterDiscardTopInstanceId,
      siblings: model.encounterDiscard,
    },
    ...model.scenarioDecks.flatMap(scenarioDeckPiles),
    ...model.scenarioAreas.map((area): Pile => ({
      kind: "scenarioArea",
      name: area.name.toUpperCase(),
      count: area.count,
      countLabel: scenarioAreaTag(area),
      art: area.topArt,
      instanceId: area.instanceIds[0] ?? null,
      siblings: area.instanceIds,
    })),
  ];
  // The set-aside footer (MojoMania's genre sets) is one line the board placed beside the column (`splitSetAside`);
  // the piles keep the column whole.
  const slots = encounterPileSlots(rect, piles.length);
  if (model.setAside && setAsideBox) drawSetAside(scene, setAsideBox, model.setAside);
  piles.forEach(({ kind, name, count, countLabel, art, instanceId, siblings, pileTitle }, index) => {
    const box: Rect = slots[index]!;
    // A card revealed from the deck or discarded to the pile travels from or to this box itself, not the whole
    // column. A scenario area or scenario deck is not a travel-animation anchor yet — no printed effect moves a
    // card there with a motion this app plays — so only the two encounter piles register one.
    if (kind === "encounterDeck" || kind === "encounterDiscard") ctx.frame.pileRects.set(pileKey(kind), box);
    const g = scene.add.graphics();
    paintPanel(g, box, count > 0 ? "card" : "quiet", count > 0 ? "rest" : "unavailable");

    const inner: Rect = { x: box.x + 3, y: box.y + 3, width: box.width - 6, height: box.height - 6 };
    const drawn = count > 0 && drawArt(scene, ctx.art.request(scene, art), inner, { fit: "cover" }) !== null;

    // A faceup top card (Falcon's hero form) puts its name and boost on the tile: the art alone is a crop too small to read.
    const shown = kind === "encounterDeck" && drawn ? model.encounterDeckTop : null;
    const shownChips = shown ? shownTopChipsOf(box) : null;
    const chips = shownChips ?? pileChipsOf(box);
    // Name and count ride on ink chips over the art, so they stay readable and never overprint each other.
    if (drawn) {
      const chipG = scene.add.graphics();
      chipG.fillStyle(surface.ink.hex, 0.78).fillRect(chips.name.x, chips.name.y, chips.name.width, chips.name.height);
      chipG.fillRect(chips.count.x, chips.count.y, chips.count.width, chips.count.height);
      if (shownChips) {
        chipG
          .fillStyle(surface.ink.hex, 0.9)
          .fillRect(shownChips.card.x, shownChips.card.y, shownChips.card.width, shownChips.card.height);
        chipG
          .fillStyle(signal.caution.hex, 1)
          .fillRect(shownChips.card.x, shownChips.card.y, 3, shownChips.card.height);
      }
    }
    // Roomy chips get a bigger name and count: at 9px the name was the smallest text on the table.
    const roomy = chips.name.height >= 18;
    const nameRole = roomy ? { ...typeRole.label, size: 11 } : typeRole.label;
    const countRole = shownChips
      ? typeRole.statSmall
      : chips.mode === "row"
        ? roomy
          ? typeRole.statSmall
          : typeRole.label
        : typeRole.stat;
    // A short tile has one strip, so the faceup card's boost rides in the name there.
    const shownInRow = shown && !shownChips ? ` \u00b7 ${shown.boostLine}` : "";
    const nameText = label(
      scene,
      chips.name.x + 5,
      chips.name.y + chips.name.height / 2,
      `${name}${shownInRow}`,
      nameRole,
      drawn ? surface.paper.hex : surface.ink.hex,
      drawn ? ink.body : ink.label,
    ).setOrigin(0, 0.5);
    fitText(nameText, chips.name.width - 10, nameRole.size);
    const countText = scene.add
      .text(
        chips.count.x + chips.count.width / 2,
        chips.count.y + chips.count.height / 2,
        countLabel ?? String(count),
        textStyle(countRole, drawn ? surface.paper.hex : surface.ink.hex),
      )
      .setOrigin(0.5);
    fitText(countText, chips.count.width - 4, countRole.size);
    if (shown && shownChips) {
      const { card } = shownChips;
      // One line for the name and one for the boost, so neither runs into the header chips or the other: the strip
      // is only 40px tall. The font steps down first, then a leading article goes ("The Trickster Tango" reads fine
      // as "Trickster Tango"); the full card is one tap away in Inspect.
      const cardName = label(
        scene,
        card.x + 8,
        card.y + 4,
        shown.name,
        { ...typeRole.label, size: 9 },
        surface.paper.hex,
        1,
      );
      fitWrapped(cardName, card.width - 12, 1, 9);
      if (cardName.text !== shown.name) {
        cardName.setText(shortPileName(shown.name)).setFontSize(9);
        fitWrapped(cardName, card.width - 12, 1, 9);
      }
      const boost = label(
        scene,
        card.x + 8,
        card.y + card.height - 3,
        shown.boostLine,
        { ...typeRole.label, size: 12 },
        signal.caution.hex,
        1,
      ).setOrigin(0, 1);
      fitText(boost, card.width - 12, 12);
    }

    // Every pile with a card in it is readable, the deck's own facedown top included (D08's own subtitle: "any
    // card, anywhere, including facedown counts") — Inspect already draws the honest "facedown" face for it via
    // `faceVisible`; this box only had no tap target to reach that with. A scenario area opens every card it
    // holds, not only the top one — it's a shared, faceup zone, closer to the discard than to a deck.
    if (count > 0 && instanceId) {
      ctx.frame.hitRects.set(instanceId, box);
      const open = (): void => ctx.inspect(instanceId, siblings.length > 0 ? siblings : undefined);
      // A discard pile fans out; a hold still reads the top card.
      addTapTarget(scene, box, {
        onTap:
          kind === "encounterDiscard"
            ? () => ctx.openPile("Encounter discard", siblings)
            : kind === "scenarioDiscard" && pileTitle
              ? () => ctx.openPile(pileTitle, siblings)
              : open,
        onInspect: open,
      });
    }
  });
}

/**
 * "SET ASIDE 2" over the set names, wrapped onto as many lines as the panel's width needs (`setAsideLines`): the
 * count is the first line, the names never cut. The board sizes the box to those lines (`setAsideFooterHeight`).
 */
function drawSetAside(scene: Phaser.Scene, box: Rect, setAside: SetAsidePanel): void {
  const g = scene.add.graphics();
  paintPanel(g, box, "quiet", "rest");
  const empty = setAside.count === 0;
  const color = empty ? accent.heroRed.hex : surface.ink.hex;
  const maxWidth = box.width - 12;
  const lines = setAsideLines(setAside.count, setAside.names, box.width);
  const text = label(scene, box.x + 6, box.y + 4, lines.join("\n"), typeRole.label, color, empty ? 1 : ink.body);
  text.setWordWrapWidth(maxWidth, true);
  // A width the estimate got wrong: drop one size step before the text leaves the panel.
  if (text.height > box.height - 6) text.setFontSize(typeRole.label.size - 1);
  text.y = box.y + Math.max(3, (box.height - text.height) / 2);
}

/**
 * A printed rules card (Shatter the Illusion) as a tile: its scan's thumbnail beside its title. Tap or hold opens its
 * Inspect sheet, where the scan and the printed text are read in full.
 */
function drawReferenceTile(ctx: BoardDrawContext, rect: Rect, reference: ReferenceCardView): void {
  if (rect.height <= 0 || rect.width <= 0) return;
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, rect, "quiet", "rest");
  const thumb: Rect = {
    x: rect.x + 4,
    y: rect.y + 3,
    width: Math.round((rect.height - 6) * 0.69),
    height: rect.height - 6,
  };
  drawArt(scene, ctx.art.request(scene, reference.art), thumb, { fit: "cover" });
  const text = label(
    scene,
    thumb.x + thumb.width + 6,
    rect.y + rect.height / 2,
    reference.title,
    typeRole.label,
    surface.ink.hex,
    ink.label,
  );
  text.setOrigin(0, 0.5).setWordWrapWidth(rect.x + rect.width - text.x - 4, true);
  fitWrapped(text, rect.x + rect.width - text.x - 4, 2, typeRole.label.size);
  const open = (): void => ctx.inspectReference(reference);
  addTapTarget(scene, rect, { onTap: open, onInspect: open });
}

/** The room under a scheme's panel for its counters and attachments, which the scheme panel has no line for. */
const AREA_NOTE_HEIGHT = 22;

/**
 * The scenario play areas in play (the mission area, MC45 p. 5): cards that are in play but that no player controls,
 * drawn as the table draws their kind elsewhere (a scheme as a scheme with its threat meter, an ally or enemy as a
 * character with its hit points, exhausted state, keywords and attachments). The header says whose they are: nobody's.
 * Every card is tappable for Inspect, which words what the area means for it (`view/inspect-notes.ts`).
 */
export function drawScenarioPlayAreas(
  ctx: BoardDrawContext,
  rect: Rect,
  areas: readonly ScenarioPlayAreaPanel[],
  /** The scenario's printed rules cards, drawn as tiles in a neutral area (Inspect opens each). */
  references: readonly ReferenceCardView[] = [],
  /** `"stack"`: the neutral cards one above the other (a phone's tab), else side by side. */
  layout: "row" | "stack" = "row",
): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, rect, "rail", "rest");
  const share = rect.width / Math.max(1, areas.length);
  areas.forEach((area, index) => {
    const box: Rect = { x: rect.x + index * share, y: rect.y, width: share, height: rect.height };
    label(
      scene,
      box.x + 8,
      box.y + 6,
      area.neutral ? `${area.name} area · shared by the pod` : `${area.name} area · no player controls it`,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );
    const inner: Rect = { x: box.x + 8, y: box.y + 22, width: box.width - 16, height: box.height - 30 };
    if (area.cards.length === 0) {
      const empty = scene.add.graphics();
      paintPanel(empty, inner, "quiet", "unavailable");
      scene.add
        .text(
          inner.x + inner.width / 2,
          inner.y + inner.height / 2,
          "Nothing here",
          textStyle(typeRole.body, surface.ink.hex, ink.meta),
        )
        .setOrigin(0.5);
      return;
    }
    // A neutral card says what its shared number does in a line under it, whichever kind of card it is. Its cards
    // are drawn wide (art column, name and numbers beside it), the way the villain's own panel is, so Loki's hit
    // points and Worlds Collide's threat read at the same size as the Avatar's; the rules cards sit beside them.
    const neutralLayout = area.neutral
      ? (layout === "stack" ? neutralStack : neutralRow)(inner, area.cards.length, references.length)
      : null;
    if (neutralLayout) {
      area.cards.forEach((card, at) => {
        const slot = neutralLayout.slots[at]!;
        if (slot.height <= 0) return;
        if (card.scheme) drawScheme(ctx, slot, card.scheme);
        else drawCharacter(ctx, slot, card.panel, { shape: "wide" });
        if (card.note) {
          const note = label(
            scene,
            slot.x + 2,
            slot.y + slot.height + 5,
            card.note,
            typeRole.label,
            surface.ink.hex,
            ink.label,
          );
          fitText(note, slot.width - 4, typeRole.label.size);
        }
      });
      references.forEach((reference, at) => drawReferenceTile(ctx, neutralLayout.refs[at]!, reference));
      return;
    }
    const slots = missionSlots(
      inner,
      area.cards.map((card) => (card.scheme ? "scheme" : "card")),
    );
    area.cards.forEach((card, at) => {
      const slot = slots[at]!;
      if (!card.scheme) {
        drawCharacter(ctx, slot, card.panel, { shape: "card" });
        return;
      }
      const room = slot.height > 90 ? AREA_NOTE_HEIGHT : 0;
      drawScheme(ctx, { ...slot, height: slot.height - room }, card.scheme);
      const attached = card.panel.attachments.map((chip) => chip.name);
      const words = [counterNote(card.panel.counters), attached.length > 0 ? `with ${attached.join(", ")}` : null]
        .filter((part): part is string => part !== null)
        .join(" · ");
      if (room > 0 && words) {
        const note = label(
          scene,
          slot.x + 2,
          slot.y + slot.height - room + 5,
          words,
          typeRole.label,
          surface.ink.hex,
          ink.label,
        );
        fitText(note, slot.width - 4, typeRole.label.size);
      }
    });
  });
}

/** The width a compact play area's own caption takes, left of its thumbnails. */
const COMPACT_PLAY_CAPTION = 84;

export function drawPlayArea(
  ctx: BoardDrawContext,
  rect: Rect,
  model: BoardModel,
  options: { readonly compact?: boolean } = {},
): void {
  const { scene } = ctx;
  const compact = options.compact === true;
  const g = scene.add.graphics();
  paintPanel(g, rect, "rail", "rest");
  // The whole zone takes a sideways drag once the row scrolls: a finger that starts between cards, above or below them
  // or on the caption still scrolls the row. Made first, so every card, arrow and form card drawn after it sits on top
  // and keeps its own press; switched on below once the row is measured.
  const dragSurface = scene.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0);
  if (compact) {
    // The tall villain band's strip (TB1): the caption beside the thumbnails, not above them.
    const caption = label(
      scene,
      rect.x + 10,
      rect.y + rect.height / 2,
      "play area",
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );
    caption.setOrigin(0, 0.5);
    fitText(caption, COMPACT_PLAY_CAPTION - 10, typeRole.label.size);
  }
  // Fitted to the row once its width is known (a fanned-out form column leaves a phone's row narrow).
  const wideCaption = compact
    ? null
    : label(scene, rect.x + 8, rect.y + 6, "your play area", typeRole.label, surface.ink.hex, ink.label);

  // A second deck the identity brings (Doctor Strange's Invocation deck) gets
  // its own column beside the play area, the way the encounter piles sit
  // beside the enemies — present only for the one identity that has one, so
  // every other hero's play area is unchanged (PLAN.md Phase 7: "the board
  // has no Invocation deck; the client never mentions `separateDeck`").
  // A set of form cards (Spectrum's energy forms, issue #308) shares that column, above any second deck.
  const hasSeparateDecks = model.separateDecks.length > 0;
  const formGroups = model.formCards;
  const sideRows = model.separateDecks.length + formGroups.length;
  const sideHeight = compact ? rect.height - 12 : rect.height - 30;
  const widestForms = Math.max(0, ...formGroups.map((group) => group.cards.length));
  const separateWidth =
    formGroups.length > 0
      ? formColumnWidth(rect.width, sideHeight, widestForms, sideRows, ctx.cardScale, ctx.formFan.t)
      : hasSeparateDecks
        ? separateColumnWidth(rect.width, sideHeight, ctx.cardScale)
        : 0;
  const gap = sideRows > 0 ? 8 : 0;
  const inner: Rect = compact
    ? {
        x: rect.x + COMPACT_PLAY_CAPTION,
        y: rect.y + 6,
        width: rect.width - COMPACT_PLAY_CAPTION - 8 - separateWidth - gap,
        height: rect.height - 12,
      }
    : {
        x: rect.x + 8,
        y: rect.y + 22,
        width: rect.width - 16 - separateWidth - gap,
        height: rect.height - 30,
      };
  if (sideRows > 0) {
    const sideRect: Rect = {
      x: inner.x + inner.width + gap,
      y: inner.y,
      width: separateWidth,
      height: inner.height,
    };
    // Each form group takes an even share of the column's height; the second decks lay out in what is left. The form
    // column starts at the zone's own caption line, so its heading reads on one line with "your play area".
    const formRect: Rect = compact
      ? sideRect
      : { ...sideRect, y: rect.y + 6, height: sideRect.height + (inner.y - rect.y - 6) };
    const formRowHeight = (formRect.height - (sideRows - 1) * 8) / sideRows;
    formGroups.forEach((group, index) => {
      drawFormCards(ctx, { ...formRect, y: formRect.y + index * (formRowHeight + 8), height: formRowHeight }, group);
    });
    if (hasSeparateDecks) {
      const used = formRect.y - sideRect.y + formGroups.length * (formRowHeight + 8);
      const separateRect: Rect = { ...sideRect, y: sideRect.y + used, height: sideRect.height - used };
      drawSeparateDecks(ctx, separateRect, model.separateDecks, model.perspectiveId);
    }
  }

  if (wideCaption) fitText(wideCaption, inner.width, typeRole.label.size);

  if (model.myPlayArea.length === 0) {
    // A dashed slot: present, not yet filled.
    const empty = scene.add.graphics();
    paintPanel(empty, inner, "quiet", "unavailable");
    const hint = scene.add
      .text(inner.x + inner.width / 2, inner.y + inner.height / 2, "Play a card to put it here", {
        ...textStyle(typeRole.body, surface.ink.hex, ink.meta),
        align: "center",
      })
      .setOrigin(0.5);
    // Narrow beside fanned-out form cards on a phone: wrap rather than run past the slot.
    fitWrapped(hint, inner.width - 12, 3, typeRole.body.size);
    // (a compact strip shows the same line, shortened by its caption)
    return;
  }
  // Past a readable floor the cards stop shrinking and the row scrolls sideways (issue #119, `view/play-area-row.ts`).
  const { slots } = playAreaRow(inner, model.myPlayArea.length, ctx.cardScale);
  const ids = model.myPlayArea.map((panel) => panel.instanceId);
  const selection = ctx.controller.selection;
  const { row } = ctx.playAreaScroll;
  ctx.playAreaScroll.settle(
    inner,
    ids,
    slots,
    ctx.focusedCard,
    selection.kind === "targeting" ? selection.action.targets : null,
  );
  if (!row.canScroll) {
    model.myPlayArea.forEach((panel, index) => drawCharacter(ctx, slots[index]!, panel));
    if (compact) drawCompactPlayNote(scene, inner, slots, model);
    return;
  }
  dragSurface.setInteractive();
  bindDragSurface(scene, dragSurface, row.drag);
  const count = label(
    scene,
    0,
    compact ? rect.y + 4 : rect.y + 6,
    `${ids.length} cards`,
    typeRole.label,
    surface.ink.hex,
    ink.label,
  );
  count.setX(inner.x + inner.width - count.width);
  // No room beside the caption (a narrow row): the scroll chevrons still say there is more.
  if (wideCaption && count.x < wideCaption.x + wideCaption.width + 8) count.destroy();

  // Every tap target the cards register (the card, and each attachment strip on it), where it was drawn, so its focus
  // rect can follow the scroll. A sideways drag that starts on any of them scrolls the row.
  const drawnAt = row.scrollX;
  const registered: { readonly id: InstanceId; readonly rect: Rect }[] = [];
  const rowCtx: BoardDrawContext = {
    ...ctx,
    makeTapTarget: (target, id, onTap, _drag, onHover) => {
      registered.push({ id, rect: target });
      ctx.makeTapTarget(target, id, onTap, row.drag, onHover);
    },
  };
  const before = scene.children.list.length;
  model.myPlayArea.forEach((panel, index) => {
    const slot = slots[index]!;
    drawCharacter(rowCtx, { ...slot, x: slot.x - drawnAt }, panel);
  });
  // Everything the cards just added, in one strip clipped to the zone: a scroll moves the strip, not the board
  // (`drawHand` does the same for the phone's hand).
  const strip = scene.add.container(0, 0);
  const drawn = scene.children.list.slice(before, -1);
  if (drawn.length > 0) strip.add(drawn);
  const clip: Rect = { x: inner.x - 3, y: rect.y, width: inner.width + 6, height: rect.height };
  const mask = scene.make.graphics({}, false);
  mask.fillStyle(0xffffff).fillRect(clip.x, clip.y, clip.width, clip.height);
  ctx.frame.masks.push(mask);
  setMask(strip, mask, "world");

  // Where each card is now. Its rect is cut to the zone, and a card scrolled off has none, so a ring, a beat or the
  // focus ring is never drawn over the identity or the other heroes. A mask hides pixels, not hit areas, so a card
  // answers a tap only while it is wholly inside the zone (`ui/scroll-clip.ts`).
  const place = (scrollX: number): void => {
    const shift = drawnAt - scrollX;
    ids.forEach((id, index) => {
      const slot = slots[index]!;
      const slice = sliceWithin({ ...slot, x: slot.x - scrollX }, inner);
      if (slice) ctx.frame.hitRects.set(id, slice);
      else ctx.frame.hitRects.delete(id);
    });
    for (const { id, rect: target } of registered) {
      const key = focusKey({ kind: "card", instanceId: id });
      const slice = sliceWithin({ ...target, x: target.x + shift }, inner);
      if (slice) ctx.frame.focusRects.set(key, slice);
      else ctx.frame.focusRects.delete(key);
    }
    clipToViewport([strip], clip);
  };
  place(drawnAt);
  const hint = drawPlayAreaScrollHint(ctx, inner, drawnAt);
  row.attach((scrollX) => {
    strip.setX(drawnAt - scrollX);
    place(scrollX);
    hint(scrollX);
    ctx.onRegionScroll();
  });
}

/** The compact strip's one-line note, in the room right of its last thumbnail: how many cards are out, and how many are tapped. */
function drawCompactPlayNote(scene: Phaser.Scene, inner: Rect, slots: readonly Rect[], model: BoardModel): void {
  const last = slots[slots.length - 1];
  if (!last) return;
  const left = last.x + last.width + 10;
  const room = inner.x + inner.width - left;
  if (room < 60) return;
  const exhausted = model.myPlayArea.filter((panel) => panel.exhausted).length;
  const text = `${model.myPlayArea.length} in play${exhausted > 0 ? ` · ${exhausted} exhausted` : ""}`;
  const note = scene.add
    .text(left, inner.y + inner.height / 2, text, textStyle(typeRole.body, surface.ink.hex, ink.meta))
    .setOrigin(0, 0.5);
  fitText(note, room, typeRole.body.size);
}

/**
 * A fade and a chevron on whichever edge of the play area has more cards past it. The chevron is a button: a tap
 * moves the row most of a zone's width that way, for a mouse with no wheel to hand. Only a real tap (`onTap`): a
 * swipe that lifts over a chevron is the swipe's, and a drag that starts on one scrolls the row like anywhere else in
 * the zone. Returns the redraw for a new scroll position.
 */
function drawPlayAreaScrollHint(ctx: BoardDrawContext, area: Rect, scrollX: number): (scrollX: number) => void {
  const { scene } = ctx;
  const { row } = ctx.playAreaScroll;
  const band = 28;
  const g = scene.add.graphics();
  const ground = skin("rail", "rest").fill;
  const style = { ...textStyle({ ...typeRole.label, size: 26 }, surface.ink.hex), fontStyle: "bold" };
  const edges = ([-1, 1] as const).map((direction) => {
    const x = direction < 0 ? area.x : area.x + area.width - band;
    const chevron = scene.add
      .text(x + band / 2, area.y + area.height / 2, direction < 0 ? "‹" : "›", style)
      .setOrigin(0.5);
    const zone = scene.add.zone(x, area.y, band, area.height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    bindDragSurface(scene, zone, row.drag);
    onTap(zone, () => row.scrollBy(direction * area.width * 0.8), `playAreaChevron:${direction}`);
    return { direction, chevron, zone };
  });
  const draw = (at: number): void => {
    g.clear();
    // Stepped bars, not a gradient fill: a gradient beside a masked layer blanked the board in headless GPU runs
    // (`drawHandScrollHint`).
    const steps = 6;
    const step = band / steps;
    for (const { direction, chevron, zone } of edges) {
      const shown = direction < 0 ? at > 0.5 : at < row.maxScroll - 0.5;
      chevron.setVisible(shown);
      if (zone.input) zone.input.enabled = shown;
      if (!shown) continue;
      for (let i = 0; i < steps; i++) {
        g.fillStyle(ground, 0.2 + (0.75 * (i + 1)) / steps);
        if (direction > 0) g.fillRect(area.x + area.width - band + i * step, area.y, step, area.height);
        else g.fillRect(area.x + band - (i + 1) * step, area.y, step, area.height);
      }
    }
  };
  draw(scrollX);
  return draw;
}

/**
 * A hero's form cards under their heading (issue #308). Folded, they stack so they take one card's room beside a busy
 * play area: the front card whole and an edge of each card behind it, "Tap to see all 3" under them, and a tap on the
 * stack fans them out. Fanned out, the column widens and pushes the play row over (it scrolls if it must), every card
 * sits side by side as its own card (hover popover, a tap reads it), and Collapse under them folds the stack back. The
 * board animates between the two (`formFan.t`). Spectrum's energy forms put the active one in front, ringed and marked
 * ACTIVE (in alter-ego form none is), every face shown since their owner knows them. One double-sided form card (Vision,
 * Shadowcat, Nick Fury) is a stack of one, marked with the form a flip changes to, and a tap reads it.
 */
function drawFormCards(ctx: BoardDrawContext, row: Rect, group: FormCardGroup): void {
  const { scene } = ctx;
  // The form in use in front, the rest behind it in printed order.
  const cards = [...group.cards].sort((a, b) => Number(b.active) - Number(a.active));
  const isSet = cards.length > 1;
  const fan = isSet ? ctx.formFan : { ...ctx.formFan, open: false, t: 0 };
  const layout = formStackLayout(row, cards.length, fan.t);
  if (!layout || layout.cards[0]!.height < 24) return;
  const heading = label(scene, row.x, row.y, group.title, typeRole.label, surface.ink.hex, ink.label);
  fitText(heading, row.width, typeRole.label.size);
  // Back to front, so the front card is drawn last, over the edges of the rest.
  for (let index = cards.length - 1; index >= 0; index--) {
    const card = cards[index]!;
    const rect = layout.cards[index]!;
    const front = index === 0;
    // Folded, the cards behind are dimmed edges; they brighten as they fan out.
    const dim = front ? 1 : ink.secondary + (1 - ink.secondary) * fan.t;
    const frame = scene.add.graphics();
    frame.fillStyle(surface.ink.hex, 1).fillRect(rect.x - 1, rect.y - 1, rect.width + 2, rect.height + 2);
    frame.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const drawn = drawArt(scene, ctx.art.request(scene, card.art), rect, { fit: "cover", alpha: dim }) !== null;
    if (!drawn && (front || fan.open)) {
      const name = scene.add
        .text(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          card.name,
          textStyle(typeRole.label, surface.ink.hex, 1),
        )
        .setOrigin(0.5);
      fitText(name, rect.width - 4, typeRole.label.size);
    }
    if (!front && !fan.open) continue;
    const foot = { x: rect.x, y: rect.y + rect.height - 16, width: rect.width, height: 16 };
    if (isSet && card.active) {
      const ring = scene.add.graphics();
      ring.lineStyle(3, signal.heal.hex, 1).strokeRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4);
      if (rect.height >= 60) drawFootStrip(scene, foot, "ACTIVE", "ability", 1);
    } else if (!isSet && card.otherFace && rect.height >= 60) {
      drawFootStrip(scene, foot, `FLIPS TO ${card.otherFace.toUpperCase()}`, "ability", 1);
    }
    // Threat and counters the card holds (Nick Fury's suit form), over the top of the card.
    if (card.tokens && rect.height >= 60) {
      drawFootStrip(scene, { x: rect.x, y: rect.y, width: rect.width, height: 16 }, card.tokens, "threat", 1);
    }
  }
  const ids = cards.map((card) => card.instanceId);
  if (fan.open) {
    // Fanned out: each card is a card on the table, and Collapse folds them back.
    cards.forEach((card, index) => {
      const rect = layout.cards[index]!;
      ctx.frame.hitRects.set(card.instanceId, rect);
      ctx.makeTapTarget(
        rect,
        card.instanceId,
        () => ctx.controller.onCharacterTap(card.instanceId),
        ctx.playAreaScroll.row.drag,
      );
    });
    if (layout.footer) {
      const width = Math.min(layout.footer.width, 140);
      ctx.frame.buttons.push(
        new McButton(scene, {
          kind: "secondary",
          label: "Collapse",
          type: typeRole.label,
          rect: { ...layout.footer, x: layout.footer.x + (layout.footer.width - width) / 2, width },
          onClick: () => fan.setOpen(false),
        }),
      );
    }
    return;
  }
  if (layout.footer) {
    const hint = label(
      scene,
      layout.footer.x + layout.footer.width / 2,
      layout.footer.y + layout.footer.height / 2,
      `Tap to see all ${cards.length}`,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    ).setOrigin(0.5, 0.5);
    fitText(hint, layout.footer.width, typeRole.label.size);
  }
  const top = ids[0]!;
  ctx.frame.hitRects.set(top, layout.cards[0]!);
  // While a target prompt is open the stack answers it as the front card; otherwise a set fans out and a lone card reads.
  const onTap = (): void => {
    if (!isSet || ctx.controller.selection.kind === "targeting") ctx.controller.onCharacterTap(top);
    else fan.setOpen(true);
  };
  // A sideways swipe from the stack scrolls the play row beside it, like a drag anywhere else in the zone, and is never
  // a tap on the stack.
  ctx.makeTapTarget(layout.stack, top, onTap, ctx.playAreaScroll.row.drag);
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
function drawSeparateDecks(
  ctx: BoardDrawContext,
  rect: Rect,
  decks: readonly SeparateDeckPile[],
  perspectiveId: PlayerId,
): void {
  const { scene } = ctx;
  // A sideways swipe from a pile scrolls the play row beside it, like a drag anywhere else in the zone.
  const { onDrag, onDragEnd } = ctx.playAreaScroll.row.drag;
  const rowDrag = { onDrag, onDragEnd };
  const rowHeight = separateRowHeight(
    rect.height,
    decks.length,
    rect.width,
    decks.some((deck) => deck.hasDiscard),
  );
  decks.forEach((deck, index) => {
    const row: Rect = { x: rect.x, y: rect.y + index * (rowHeight + 8), width: rect.width, height: rowHeight };
    if (row.y + row.height > rect.y + rect.height) return;
    label(scene, row.x, row.y, deck.name, typeRole.label, surface.ink.hex, ink.label);
    const boxTop = row.y + 14;
    // Cards of an encounter-card deck that are out of it (a Labor card being revealed, in play, in the victory display):
    // one line each under the boxes, a tap on it reads the card. Only as many as the row has room for.
    const lineCount = Math.min(deck.outside.length, Math.max(0, Math.floor((row.height - 14 - 30) / 12)), 3);
    const boxHeight = row.height - 14 - lineCount * 12;
    if (boxHeight < 30) return;
    // Portrait card-shaped piles (`separatePileBoxes`), never a landscape box that crops a portrait top card.
    const { deck: deckBox, discard: discardBox } = separatePileBoxes(
      { x: row.x, y: boxTop, width: row.width },
      boxHeight,
      deck.hasDiscard,
    );

    drawPile(ctx, deckBox, "deck", deck.deckCount, deck.topArt, "foot");
    ctx.frame.pileRects.set(pileKey("separateDeck", perspectiveId, deck.name), deckBox);
    // A deck whose cards never reach a discard pile (Weather, Labor, Gift) has no discard box and no count to draw.
    if (deck.hasDiscard) {
      drawPile(ctx, discardBox, "disc.", deck.discardCount, deck.discardTopArt, "foot");
      ctx.frame.pileRects.set(pileKey("separateDiscard", perspectiveId, deck.name), discardBox);
    }
    deck.outside.slice(0, lineCount).forEach((card, at) => {
      const line = label(
        scene,
        row.x,
        boxTop + boxHeight + 2 + at * 12,
        card.line,
        typeRole.label,
        surface.ink.hex,
        ink.label,
      );
      fitText(line, row.width, typeRole.label.size);
      ctx.makeTapTarget(
        { x: row.x, y: boxTop + boxHeight + 2 + at * 12, width: row.width, height: 12 },
        card.instanceId,
        () => ctx.inspect(card.instanceId),
        rowDrag,
      );
    });

    // The deck's top card is the point of it — Master of the Mystic Arts
    // (`09005`) and Spell Mastery (`09001a`) both read it directly — so it is
    // both a target the board highlights during that ability and a card the
    // player can always stop to read, the same as any other faceup card.
    if (deck.topInstanceId) {
      const top = deck.topInstanceId;
      ctx.frame.hitRects.set(top, deckBox);
      addTapTarget(scene, deckBox, { onTap: () => ctx.inspect(top), onInspect: () => ctx.inspect(top), ...rowDrag });
    }
    if (deck.discardTopInstanceId) {
      const top = deck.discardTopInstanceId;
      // Also a beat anchor (`view/beats.ts`'s `abilityResolved` case): an Invocation card that just resolved its
      // Special and moved to this deck's own discard (Spell Mastery, Natural Talent) needs a rect here to land its
      // beat on — without it, "resolve → discard" was a state change with nowhere on screen to point at.
      ctx.frame.hitRects.set(top, discardBox);
      addTapTarget(scene, discardBox, { onTap: () => ctx.inspect(top), onInspect: () => ctx.inspect(top), ...rowDrag });
    }
  });
}

export function drawTeam(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, rect, "rail", "rest");
  // Cards another seat controls that this player may use now ("any player" Actions), as chips under that seat's row.
  const { game, legal } = appSession().store.state;
  const usable = game
    ? otherSeatAbilityCards(game, legal?.actions ?? null, model.perspectiveId, POOL_DEPS).filter(
        (card) => ctx.controller.abilityLine(card.instanceId) !== null,
      )
    : [];
  const layout = teamLayout(
    rect,
    model.team.length,
    model.team.map((seat) => !seat.eliminated && usable.some((card) => card.seatId === seat.playerId)),
  );
  if (layout.header) label(scene, rect.x + 8, rect.y + 6, "other heroes", typeRole.label, surface.ink.hex, ink.label);

  model.team.forEach((seat, index) => {
    const row = layout.rows[index]!;
    // Registered like any card on the table: a beat on this hero ("−4")
    // floats off the row, a heal aimed at them rings it, and a tap reads them.
    // A seat providing a Team-Up character gets its ring beside the row, which gives up the width.
    const rings = ctx.teamUpRings;
    const badges = (!seat.eliminated && rings?.byPlayer.get(seat.playerId)) || [];
    const beside = rowRings(
      row,
      badges.map((badge) => `${badge.key}@${seat.identityInstanceId}`),
      ringDiameterFor(rings?.tabbed ?? false),
    );
    const drawn = beside.row;
    ctx.frame.hitRects.set(seat.identityInstanceId, drawn);
    if (seat.eliminated) drawEliminatedSeat(scene, drawn, seat, layout.rowStyle);
    else drawLiveSeat(ctx, drawn, seat, layout.rowStyle);
    ctx.makeTapTarget(drawn, seat.identityInstanceId, () => ctx.inspect(seat.identityInstanceId));
    if (!seat.eliminated)
      drawDealtPile(ctx, drawn, "seat", seat.playerId, seat.dealtFacedown, layout.rowStyle === "one-line");
    // A seat holding an Action for this turn (RRG "Player Turn", pp. 34-35): a button takes the board to that seat.
    if (!seat.eliminated && appSession().store.state.offTurnSeats.includes(seat.playerId)) {
      const oneLine = layout.rowStyle === "one-line";
      const chip: Rect = oneLine
        ? { x: drawn.x + drawn.width - 66, y: drawn.y + 1, width: 64, height: drawn.height - 2 }
        : { x: drawn.x + drawn.width - 70, y: drawn.y + drawn.height - 28, width: 64, height: 24 };
      ctx.frame.buttons.push(
        new McButton(scene, {
          kind: "secondary",
          label: "Act",
          type: typeRole.label,
          rect: chip,
          onClick: () => void appSession().store.takeOffTurnSeat(seat.playerId),
        }),
      );
    }
    const strip = layout.chips[index];
    if (strip)
      drawSeatChips(
        ctx,
        strip,
        usable.filter((card) => card.seatId === seat.playerId),
      );
    if (rings) {
      for (const slot of beside.slots) {
        const badge = badges.find((candidate) => slot.key === `${candidate.key}@${seat.identityInstanceId}`);
        if (badge) drawTeamUpRing(scene, slot, badge, rings);
      }
    }
  });
}

/** One chip per usable card, side by side under the seat's row: "▶ Plot Convenience". A tap opens it in Inspect. */
function drawSeatChips(ctx: BoardDrawContext, strip: Rect, cards: readonly OtherSeatAbilityCard[]): void {
  const { scene } = ctx;
  const gap = 4;
  const width = (strip.width - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const chip: Rect = { x: strip.x + index * (width + gap), y: strip.y, width, height: strip.height };
    const g = scene.add.graphics();
    paintPanel(g, chip, "card", targetState(ctx.controller.selection, card.instanceId));
    fitText(
      scene.add
        .text(
          chip.x + 6,
          chip.y + chip.height / 2,
          `\u25b6 ${card.name}`,
          textStyle(typeRole.label, signal.heal.hex, 1),
        )
        .setOrigin(0, 0.5),
      width - 12,
      typeRole.label.size,
    );
    ctx.frame.hitRects.set(card.instanceId, chip);
    ctx.makeTapTarget(chip, card.instanceId, () => ctx.inspect(card.instanceId));
  });
}

function drawLiveSeat(ctx: BoardDrawContext, row: Rect, seat: SeatRow, rowStyle: TeamLayout["rowStyle"]): void {
  const { scene } = ctx;
  const rg = scene.add.graphics();
  paintPanel(rg, row, "card", targetState(ctx.controller.selection, seat.identityInstanceId));
  const dim = dimAlpha(ctx.controller.selection, seat.identityInstanceId);
  const rightColumn = 58;
  const offsets = seatLineOffsets(row.height);
  const hp = seat.hp ? `${seat.hp.current}/${seat.hp.max} HP` : "\u2014";
  const form = seat.form === "hero" ? "Hero" : "Alter-ego";
  if (rowStyle === "one-line") {
    // No room for a second line: the name left, and what matters most (turn marker, HP) on the right.
    const right = label(
      scene,
      row.x + row.width - 6,
      row.y + row.height / 2,
      [
        seat.dealtFacedown.length > 0 ? dealtWords(seat.dealtFacedown.length) : "",
        seat.isFirstPlayer ? "1st" : "",
        seat.done ? "done" : "",
        hp,
      ]
        .filter(Boolean)
        .join(" · ")
        .toUpperCase(),
      typeRole.label,
      surface.ink.hex,
      ink.label * dim,
    ).setOrigin(1, 0.5);
    fitText(
      scene.add
        .text(row.x + 6, row.y + row.height / 2, seat.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
        .setOrigin(0, 0.5),
      row.width - 18 - right.width,
      typeRole.rowTitle.size,
    );
    return;
  }
  // Facedown cards dealt to this hero ride on the name line (`dealt-pile.ts`): the name gives up the width they take.
  const pile = seat.dealtFacedown.length > 0 ? dealtPileParts(row, "seat") : null;
  fitText(
    scene.add.text(row.x + 6, row.y + offsets.name, seat.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim)),
    pile ? Math.max(40, pile.rect.x - 6 - (row.x + 6)) : row.width - 12 - rightColumn,
    typeRole.rowTitle.size,
  );
  // "turn done" sits at the right of this line, and a Team-Up ring takes the row's right edge: when the line does not
  // fit, it drops its least important part first (the hand count, then the form) rather than shrink to nothing.
  // The first player token takes the row's top right corner (`board/first-player-token.ts`), so "turn done" sits left of it.
  const tokenReserve = seat.isFirstPlayer ? 40 : 0;
  const room = row.width - 12 - (seat.done ? 84 : 0) - tokenReserve;
  const detail = label(scene, row.x + 6, row.y + offsets.detail, "", typeRole.label, surface.ink.hex, ink.label * dim);
  // A row too short for the status pips below spells its statuses out on this line instead, so "stunned" is never lost.
  const flags = row.height < 52 ? seat.statuses.map((entry) => `${entry.status} \u00b7 `).join("") : "";
  const candidates = [`${form} \u00b7 ${hp} \u00b7 ${seat.handCount} cards`, `${form} \u00b7 ${hp}`, hp];
  const withFlags = flags ? candidates.map((candidate) => flags + candidate) : [];
  for (const candidate of [...withFlags, ...candidates]) {
    detail.setText(candidate.toUpperCase());
    if (detail.width <= room) break;
  }
  fitText(detail, room, typeRole.label.size);
  // The first player token itself sits at the right of the name line (`board/first-player-token.ts`).
  if (seat.done) {
    label(
      scene,
      row.x + row.width - 6 - tokenReserve,
      row.y + offsets.detail,
      "turn done",
      typeRole.label,
      signal.heal.hex,
      ink.body,
    ).setOrigin(1, 0);
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
  // A faceup top card (Magik's) is public: other seats read it to plan around her upgrades and spells.
  const notes = [...seat.effects, ...seat.borrowed, ...(seat.shownTop ? [`top: ${seat.shownTop.name}`] : [])];
  // The yellow Team-Up blurb, under the name and HP lines (and under any status or note chips): this hero's alter-ego
  // is what keeps a present pair from being playable. Skipped when the row has no room for it.
  const blurbTop = lineY + (seat.statuses.length > 0 || notes.length > 0 ? 20 : 0);
  if (ctx.teamUpRings?.waiting.has(seat.playerId) && blurbTop + 14 <= row.y + row.height) {
    // Clear of the Act button that sits at the row's bottom right while this seat holds an Action for the turn.
    const actReserve = appSession().store.state.offTurnSeats.includes(seat.playerId) ? 70 : 0;
    drawTeamUpBlurb(scene, row.x + 6, blurbTop, row.width - 12 - actReserve, dim);
  }
  if (notes.length > 0) {
    const room = row.x + row.width - 6 - cursor;
    const chip: Rect = { x: cursor, y: lineY, width: room, height: 16 };
    const cg = scene.add.graphics();
    cg.fillStyle(surface.ink.hex, dim).fillRect(chip.x, chip.y, chip.width, chip.height);
    cg.fillStyle(signal.caution.hex, dim).fillRect(chip.x, chip.y, 3, chip.height);
    fitText(
      label(
        scene,
        chip.x + 7,
        chip.y + chip.height / 2,
        notes.join(" · "),
        typeRole.label,
        signal.caution.hex,
        dim,
      ).setOrigin(0, 0.5),
      chip.width - 10,
      typeRole.label.size,
    );
  }
}

/**
 * A defeated hero stays at the table, visibly out of it: an ink tile hatched
 * in Hero Red with the name struck through and ELIMINATED stamped across.
 * Graying the row was all this used to do, and next to a stale "done" it read
 * as a hero sitting out a turn — three seats died over two rounds unnoticed.
 */
function drawEliminatedSeat(scene: Phaser.Scene, row: Rect, seat: SeatRow, rowStyle: TeamLayout["rowStyle"]): void {
  const offsets = seatLineOffsets(row.height);
  const rg = scene.add.graphics();
  rg.fillStyle(surface.ink.hex, 1).fillRect(row.x, row.y, row.width, row.height);
  hatchRect(rg, row, accent.heroRed.hex, 0.3, 12, 3);
  rg.lineStyle(2, accent.heroRed.hex, 1).strokeRect(row.x, row.y, row.width, row.height);

  const name = scene.add.text(
    row.x + 6,
    row.y + (rowStyle === "one-line" ? Math.max(1, (row.height - 14) / 2) : offsets.name),
    seat.name,
    textStyle(typeRole.rowTitle, surface.paper.hex, 0.6),
  );
  fitText(name, row.width * 0.5, typeRole.rowTitle.size);
  rg.lineStyle(2, surface.paper.hex, 0.8).lineBetween(
    name.x - 2,
    name.y + name.height / 2,
    name.x + name.width + 2,
    name.y + name.height / 2,
  );
  if (rowStyle === "two-line") {
    label(
      scene,
      row.x + 6,
      row.y + offsets.detail,
      seat.sittingOut ? "sitting out this scenario" : "defeated · out of the game",
      typeRole.label,
      surface.paper.hex,
      ink.meta,
    );
  }

  const stamp = scene.add
    .text(row.x + row.width - 8, row.y + row.height / 2, seat.sittingOut ? "SITTING OUT" : "ELIMINATED", {
      ...textStyle(typeRole.barTitle, accent.heroRed.hex),
      stroke: cssOf(surface.ink.hex),
      strokeThickness: 3,
    })
    .setOrigin(1, 0.5)
    .setAngle(-6)
    .setLetterSpacing(1);
  fitText(stamp, row.width * 0.48, typeRole.barTitle.size);
}
