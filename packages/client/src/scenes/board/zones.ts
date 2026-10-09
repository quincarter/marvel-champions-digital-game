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
import { cssOf, textStyle } from "../../ui/theme.js";
import { appSession } from "../../session.js";
import { McButton, fitText, fitWrapped, hatchRect, label, paintPanel } from "../../ui/widgets.js";
import type {
  BoardModel,
  CharacterPanel,
  EnvironmentPanel,
  ScenarioDeckPanel,
  SetAsidePanel,
  SeatRow,
  SeparateDeckPile,
  VillainPanel,
} from "../../view/board-model.js";
import { hpFraction, hpRatio } from "../../view/hp-format.js";
import {
  CARD_ASPECT,
  PANEL_TEXT_INSETS,
  PANEL_TEXT_MIN_WIDTH,
  cardRow,
  villainRowSlots,
  type Rect,
} from "../../view/layout.js";
import { drawCharacter, drawFootStrip } from "./character-panel.js";
import { drawScheme } from "./schemes.js";
import { missionSlots } from "../../view/mission-area-layout.js";
import { compactVillainNote, counterNote, type ScenarioPlayAreaPanel } from "../../view/board-model.js";
import { FOOT_STRIP_HEIGHT, footStripLayout } from "../../view/foot-strip-layout.js";
import {
  ENVIRONMENT_MIN_WIDTH,
  type CompactEnvironmentLayout,
  tuckedFanLayout,
  environmentCompactLayout,
  environmentSlots,
  environmentStripRoom,
  isCompactEnvironment,
} from "../../view/environment-layout.js";
import { POOL_DEPS } from "../../content/pool.js";
import { otherSeatAbilityCards, type OtherSeatAbilityCard } from "../../view/other-seat-abilities.js";
import { seatLineOffsets, teamLayout, type TeamLayout } from "../../view/team-layout.js";
import { encounterPileSlots, pileChipsOf, setAsideLines } from "../../view/encounter-pile-layout.js";
import { bandHeightWithMinions, MINION_ROW_MIN_HEIGHT } from "../../view/enemies-band.js";
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
  let beside: Rect | null = null;
  let villainAreaBottom: number;
  if (model.villains.length > 1) villainAreaBottom = drawVillainRow(ctx, rect, model);
  else {
    const single = drawSingleVillain(ctx, rect, model);
    villainAreaBottom = single.bottom;
    beside = single.minionsBeside;
  }

  // A short zone with one villain has no room under it for a readable minion row (`view/enemies-band.ts`), so the
  // minions take the empty space beside the villain instead of shrinking to a sliver or not being drawn at all.
  const minionTop = villainAreaBottom + 8;
  const minionArea: Rect = {
    x: rect.x + 10,
    y: minionTop,
    width: rect.width - 20,
    height: Math.max(0, rect.y + rect.height - minionTop - 10),
  };
  if (beside && model.minions.length > 0) {
    // Beside the villain only when that gives bigger cards than the sliver under it (many minions crowd the narrow
    // space beside it, and the row under the villain is the full width).
    const sideSlots = cardRow(beside, model.minions.length, { gap: 8, maxHeight: beside.height, align: "start" });
    const belowSlots =
      minionArea.height > 40 ? cardRow(minionArea, model.minions.length, { gap: 8, maxHeight: minionArea.height }) : [];
    if (belowSlots.length === 0 || sideSlots[0]!.height > belowSlots[0]!.height) {
      model.minions.forEach((minion, index) => {
        drawCharacter(ctx, sideSlots[index]!, minion);
        drawEngagedChip(ctx, sideSlots[index]!, minion);
      });
      return;
    }
  }
  if (model.minions.length > 0 && minionArea.height > 40) {
    const slots = cardRow(minionArea, model.minions.length, { gap: 8, maxHeight: minionArea.height });
    model.minions.forEach((minion, index) => {
      drawCharacter(ctx, slots[index]!, minion);
      drawEngagedChip(ctx, slots[index]!, minion);
    });
  }
}

/**
 * "VS SPIDER-MAN": who a minion is engaged with, hung over its top edge, drawn only when more than one seat plays
 * (`CharacterPanel.engagedName` is null otherwise). Words on ink, never a seat color alone.
 */
function drawEngagedChip(ctx: BoardDrawContext, rect: Rect, minion: CharacterPanel): void {
  if (!minion.engagedName) return;
  const { scene } = ctx;
  const text = label(scene, 0, 0, `vs ${minion.engagedName}`, typeRole.label, surface.paper.hex, 1);
  // A small tile gets a chip wider than itself (centered over it) rather than a clipped name.
  fitText(text, Math.max(88, rect.width - 14), typeRole.label.size);
  const width = Math.ceil(text.width) + 10;
  const chip: Rect = { x: rect.x + Math.min(2, (rect.width - width) / 2), y: rect.y - 9, width, height: 15 };
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(chip.x, chip.y, chip.width, chip.height);
  g.lineStyle(1, surface.paper.hex, 0.6).strokeRect(chip.x, chip.y, chip.width, chip.height);
  // The chip's own fill goes under its text: the text was created first, so it is raised above the fill.
  scene.children.bringToTop(text);
  text.setPosition(chip.x + 5, chip.y + (chip.height - text.height) / 2);
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
): number {
  // A short zone gives the band's height back before the minion row loses its own (`view/enemies-band.ts`).
  const base = bandHeightWithMinions(rect.height, unsqueezed, floor, model.minions.length);
  if (ctx.tabbed) return base;
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
  drawCharacter(ctx, villainRect, model.villain);

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
    return { bottom: villainRect.y + villainRect.height, minionsBeside: null };
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
  const unsqueezed = Math.min(128, Math.max(64, Math.round(rect.height * 0.42)));
  const bandHeight = villainBandHeight(
    ctx,
    rect,
    model,
    Math.max(56, Math.min(unsqueezed, rect.height - 20 - stripHeight)),
    VILLAIN_ROW_MAX_HEIGHT,
    56,
    stripHeight,
  );
  const bandRect: Rect = { x: rect.x + 10, y: rect.y + 10, width: rect.width - 20, height: bandHeight };
  const slots = villainRowSlots(bandRect, model.villains.length);
  model.villains.forEach((villain, index) => {
    const slot = slots[index];
    if (slot) drawCompactVillain(ctx, slot, villain);
  });
  let bottom = Math.max(bandRect.y + bandRect.height, ...slots.map((slot) => slot.y + slot.height));

  if (model.environments.length > 0) {
    // Tiles wrap into more rows under the row of villains rather than ever being dropped (`environmentStripRoom`).
    const room: Rect = { ...stripRoom!, y: bottom + 8 };
    const slots = environmentSlots(room, model.environments.length);
    model.environments.forEach((environment, index) => drawEnvironment(ctx, slots[index]!, environment));
    bottom = room.y + room.height;
  }
  return bottom;
}

/**
 * One villain's compact panel: a thumbnail, its name and stage, ATK/SCH as plain numbers (no room here for the
 * full starburst badges the single-villain panel uses), a thin HP bar, and — the design's rule that a status can
 * never be color alone — an explicit "ACTIVE" text tag rather than a highlight border, and a struck "DEFEATED"
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
  const nameText = scene.add
    .text(textLeft, top, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
    .setWordWrapWidth(textWidth);
  // The name wraps onto a second line (stepping the font down first) rather than ending in an ellipsis.
  fitWrapped(nameText, textWidth, 2, typeRole.rowTitle.size);
  top += Math.max(14, Math.ceil(nameText.height) + 1);

  if (rect.height >= 76) {
    // "VILLAIN · STAGE II" is wrapped, never cut to "VILLAIN · ST…": the stage is the part the player is reading.
    const subtitle = label(scene, textLeft, top, panel.subtitle, typeRole.label, surface.ink.hex, ink.label * dim);
    fitWrapped(subtitle, textWidth, 2, typeRole.label.size);
    top += Math.max(12, Math.ceil(subtitle.height) + 1);
  }

  // The one marker the design calls out as text, never color alone: a pulsing ring or a tinted border reads fine
  // for sighted players but says nothing to anyone relying on shape or a screen reader.
  if (villain.active) {
    const chip: Rect = { x: textLeft, y: top, width: Math.min(textWidth, 54), height: 14 };
    const cg = scene.add.graphics();
    cg.fillStyle(signal.heal.hex, dim).fillRect(chip.x, chip.y, chip.width, chip.height);
    scene.add
      .text(chip.x + chip.width / 2, chip.y + chip.height / 2, "ACTIVE", {
        ...textStyle(typeRole.label, surface.paper.hex, dim),
        fontSize: "9px",
      })
      .setOrigin(0.5)
      .setLetterSpacing(0.6);
    top += 17;
  }

  const statLine = panel.stats
    .filter((tile) => tile.label !== "HP")
    .map((tile) => `${tile.label} ${tile.value}`)
    .join("  ");
  if (statLine && rect.height - (top - rect.y) >= 24) {
    const statText = label(scene, textLeft, top, statLine, typeRole.label, surface.ink.hex, ink.body * dim);
    fitText(statText, textWidth, typeRole.label.size);
    // The note below starts under this line, not on top of it.
    top += Math.max(12, Math.ceil(statText.height) + 2);
  }

  // Statuses and attachments (War stunned, with a Golden Horse): the compact tile's one-line form of what the
  // single-villain panel draws as chips. Wrapped into whatever room is left above the HP bar; Inspect has the rest.
  const note = compactVillainNote(panel);
  const noteRoom = rect.y + rect.height - 20 - top;
  if (note && noteRoom >= 11) {
    const noteText = label(scene, textLeft, top, note, typeRole.label, surface.ink.hex, ink.body * dim);
    fitWrapped(noteText, textWidth, Math.max(1, Math.min(3, Math.floor(noteRoom / 11))), typeRole.label.size);
  }

  // A thin HP bar pinned to the foot, the compact panel's stand-in for the full panel's `McHpPlate`.
  if (panel.hp) {
    const barHeight = 7;
    const barRect: Rect = {
      x: rect.x + 4,
      y: rect.y + rect.height - barHeight - 3,
      width: rect.width - 8,
      height: barHeight,
    };
    const ratio = hpRatio(panel.hp.current, panel.hp.max);
    const bar = scene.add.graphics();
    bar.fillStyle(surface.parchment.hex, dim).fillRect(barRect.x, barRect.y, barRect.width, barRect.height);
    // `signal.heal` fills proportional to *remaining* HP, matching `McHpPlate`'s own meter — the same "how much is
    // left" reading, just in a strip thin enough to fit a compact panel's foot.
    bar.fillStyle(signal.heal.hex, dim).fillRect(barRect.x, barRect.y, barRect.width * ratio, barRect.height);
    bar.lineStyle(1.5, surface.ink.hex, dim).strokeRect(barRect.x, barRect.y, barRect.width, barRect.height);
    scene.add
      .text(barRect.x + barRect.width / 2, barRect.y - 7, hpFraction(panel.hp.current, panel.hp.max), {
        ...textStyle(typeRole.label, surface.ink.hex, dim),
        fontSize: "9px",
      })
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
  const titleBox: Rect = {
    x: inner.x,
    y: inner.y,
    width: inner.width,
    height: Math.max(30, Math.ceil(nameText.height) + 3 + 14),
  };
  if (drawn) {
    const wash = scene.add.graphics();
    wash.fillStyle(surface.ink.hex, 0.78 * dim).fillRect(titleBox.x, titleBox.y, titleBox.width, titleBox.height);
    scene.children.bringToTop(nameText);
  }
  label(
    scene,
    titleBox.x + 6,
    titleBox.y + 3 + Math.ceil(nameText.height),
    environment.subtitle,
    typeRole.label,
    onArt,
    ink.label * dim,
  );

  // Each counter kind as its own chip along the bottom: the number big, the kind spelled out beside it, so
  // "4 INFAMY" never has to be inferred from a color or a pip count.
  const chipHeight = 24;
  const counterCount = Math.min(environment.counters.length, 2);
  const countersTop =
    counterCount > 0
      ? inner.y + inner.height - 4 - counterCount * chipHeight - (counterCount - 1) * 3
      : inner.y + inner.height - 22;

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
    cg.fillStyle(signal.caution.hex, dim).fillRect(chip.x, chip.y, 3, chip.height);
    const count = scene.add
      .text(
        chip.x + 9,
        chip.y + chip.height / 2,
        String(counter.count),
        textStyle(typeRole.stat, signal.caution.hex, dim),
      )
      .setOrigin(0, 0.5);
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
  const layout = environmentCompactLayout(
    rect,
    environment.counters.map((counter) => counter.name),
    hasAbility,
  );
  const onArt = drawn ? surface.paper.hex : surface.ink.hex;
  const bg = scene.add.graphics();
  if (drawn)
    bg.fillStyle(surface.ink.hex, 0.85 * dim).fillRect(
      layout.title.x,
      layout.title.y,
      layout.title.width,
      layout.title.height,
    );
  const name = scene.add
    .text(
      layout.title.x + 6,
      layout.title.y + layout.title.height / 2,
      environment.name,
      textStyle(typeRole.rowTitle, onArt, dim),
    )
    .setOrigin(0, 0.5);
  fitText(name, layout.title.width - 12, typeRole.rowTitle.size);
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
    bg.fillStyle(signal.caution.hex, dim).fillRect(chip.x, chip.y, 3, chip.height);
    const count = scene.add
      .text(
        chip.x + 8,
        chip.y + chip.height / 2,
        String(counter.count),
        textStyle(typeRole.statSmall, signal.caution.hex, dim),
      )
      .setOrigin(0, 0.5);
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
    readonly kind:
      | "encounterDeck"
      | "encounterDiscard"
      | "dealtFacedown"
      | "scenarioArea"
      | "scenarioDeck"
      | "scenarioDiscard";
    readonly name: string;
    readonly count: number;
    readonly art: ArtSource | null;
    readonly instanceId: InstanceId | null;
    /** Every card in the pile, for a tap to open browsable through — only a scenario area needs more than one. */
    readonly siblings: readonly InstanceId[];
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
              siblings: [],
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
      art: CARD_BACKS.encounter,
      instanceId: model.encounterDeckTopInstanceId,
      siblings: [],
    },
    {
      kind: "encounterDiscard",
      name: "DISCARD",
      count: model.encounterPiles.discard,
      art: model.encounterDiscardTop,
      instanceId: model.encounterDiscardTopInstanceId,
      siblings: [],
    },
    // Cards dealt to the players facedown (Expert setup): a pile with a count and no tap target, since nobody reads them.
    ...(model.dealtFacedown > 0
      ? [
          {
            kind: "dealtFacedown" as const,
            name: "FACEDOWN",
            count: model.dealtFacedown,
            art: CARD_BACKS.encounter,
            instanceId: null,
            siblings: [],
          },
        ]
      : []),
    ...model.scenarioDecks.flatMap(scenarioDeckPiles),
    ...model.scenarioAreas.map((area): Pile => ({
      kind: "scenarioArea",
      name: area.name.toUpperCase(),
      count: area.count,
      art: area.topArt,
      instanceId: area.instanceIds[0] ?? null,
      siblings: area.instanceIds,
    })),
  ];
  // The set-aside footer (MojoMania's genre sets) is one line the board placed beside the column (`splitSetAside`);
  // the piles keep the column whole.
  const slots = encounterPileSlots(rect, piles.length);
  if (model.setAside && setAsideBox) drawSetAside(scene, setAsideBox, model.setAside);
  piles.forEach(({ kind, name, count, art, instanceId, siblings }, index) => {
    const box: Rect = slots[index]!;
    // A card revealed from the deck or discarded to the pile travels from or to this box itself, not the whole
    // column. A scenario area or scenario deck is not a travel-animation anchor yet — no printed effect moves a
    // card there with a motion this app plays — so only the two encounter piles register one.
    if (kind === "encounterDeck" || kind === "encounterDiscard") ctx.frame.pileRects.set(pileKey(kind), box);
    const g = scene.add.graphics();
    paintPanel(g, box, count > 0 ? "card" : "quiet", count > 0 ? "rest" : "unavailable");

    const inner: Rect = { x: box.x + 3, y: box.y + 3, width: box.width - 6, height: box.height - 6 };
    const drawn = count > 0 && drawArt(scene, ctx.art.request(scene, art), inner, { fit: "cover" }) !== null;

    const chips = pileChipsOf(box);
    // Name and count ride on ink chips over the art, so they stay readable and never overprint each other.
    if (drawn) {
      const chipG = scene.add.graphics();
      chipG.fillStyle(surface.ink.hex, 0.78).fillRect(chips.name.x, chips.name.y, chips.name.width, chips.name.height);
      chipG.fillRect(chips.count.x, chips.count.y, chips.count.width, chips.count.height);
    }
    // Roomy chips get a bigger name and count: at 9px the name was the smallest text on the table.
    const roomy = chips.name.height >= 18;
    const nameRole = roomy ? { ...typeRole.label, size: 11 } : typeRole.label;
    const countRole = chips.mode === "row" ? (roomy ? typeRole.statSmall : typeRole.label) : typeRole.stat;
    const nameText = label(
      scene,
      chips.name.x + 5,
      chips.name.y + chips.name.height / 2,
      name,
      nameRole,
      drawn ? surface.paper.hex : surface.ink.hex,
      drawn ? ink.body : ink.label,
    ).setOrigin(0, 0.5);
    fitText(nameText, chips.name.width - 10, nameRole.size);
    const countText = scene.add
      .text(
        chips.count.x + chips.count.width / 2,
        chips.count.y + chips.count.height / 2,
        String(count),
        textStyle(countRole, drawn ? surface.paper.hex : surface.ink.hex),
      )
      .setOrigin(0.5);
    fitText(countText, chips.count.width - 4, countRole.size);

    // Every pile with a card in it is readable, the deck's own facedown top included (D08's own subtitle: "any
    // card, anywhere, including facedown counts") — Inspect already draws the honest "facedown" face for it via
    // `faceVisible`; this box only had no tap target to reach that with. A scenario area opens every card it
    // holds, not only the top one — it's a shared, faceup zone, closer to the discard than to a deck.
    if (count > 0 && instanceId) {
      ctx.frame.hitRects.set(instanceId, box);
      const open = (): void => ctx.inspect(instanceId, siblings.length > 0 ? siblings : undefined);
      addTapTarget(scene, box, { onTap: open, onInspect: open });
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
      `${area.name} area · no player controls it`,
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
  const inner: Rect = {
    x: rect.x + 8,
    y: rect.y + 22,
    width: rect.width - 16 - separateWidth - gap,
    height: rect.height - 30,
  };
  if (hasSeparateDecks) {
    const separateRect: Rect = {
      x: inner.x + inner.width + gap,
      y: inner.y,
      width: separateWidth,
      height: inner.height,
    };
    drawSeparateDecks(ctx, separateRect, model.separateDecks, model.perspectiveId);
  }

  if (model.myPlayArea.length === 0) {
    // A dashed slot: present, not yet filled.
    const empty = scene.add.graphics();
    paintPanel(empty, inner, "quiet", "unavailable");
    scene.add
      .text(
        inner.x + inner.width / 2,
        inner.y + inner.height / 2,
        "Play a card to put it here",
        textStyle(typeRole.body, surface.ink.hex, ink.meta),
      )
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
function drawSeparateDecks(
  ctx: BoardDrawContext,
  rect: Rect,
  decks: readonly SeparateDeckPile[],
  perspectiveId: PlayerId,
): void {
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
      [seat.isFirstPlayer ? "1st" : "", seat.done ? "done" : "", hp].filter(Boolean).join(" \u00b7 ").toUpperCase(),
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
  fitText(
    scene.add.text(row.x + 6, row.y + offsets.name, seat.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim)),
    row.width - 12 - rightColumn,
    typeRole.rowTitle.size,
  );
  // "turn done" sits at the right of this line, and a Team-Up ring takes the row's right edge: when the line does not
  // fit, it drops its least important part first (the hand count, then the form) rather than shrink to nothing.
  const room = row.width - 12 - (seat.done ? 84 : 0);
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
  if (seat.isFirstPlayer) {
    label(
      scene,
      row.x + row.width - 6,
      row.y + offsets.name,
      "1st player",
      typeRole.label,
      signal.caution.hex,
      ink.body,
    ).setOrigin(1, 0);
  }
  if (seat.done) {
    label(
      scene,
      row.x + row.width - 6,
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
    drawTeamUpBlurb(scene, row.x + 6, blurbTop, row.width - 12, dim);
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
      "defeated · out of the game",
      typeRole.label,
      surface.paper.hex,
      ink.meta,
    );
  }

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
