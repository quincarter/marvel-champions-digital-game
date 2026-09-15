/**
 * Character panels: the villain, a minion, your identity, an ally — every card
 * on the table that carries stats.
 *
 * `drawCharacter` picks between the two shapes a panel takes: the wide panel,
 * with the card in a column and the numbers beside it, and the card-shaped
 * panel, where the scan *is* the panel and the live numbers ride on top.
 */

import type Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import { drawArt, type ArtFit } from "../../art/card-art.js";
import type { ArtSource } from "../../art/art-source.js";
import { ink, signal, status as statusTokens, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { McHpPlate, McStatBadge, fitText, label, paintPanel, type StatKey } from "../../ui/widgets.js";
import { attachmentChipLabel, type CharacterPanel, type StatTile } from "../../view/board-model.js";
import { CARD_ASPECT, cardStatColumn, statBlockLayout, type Rect, type StatBlock } from "../../view/layout.js";
import type { BoardDrawContext } from "./context.js";
import { dimAlpha, targetState } from "./selection.js";

/**
 * The narrowest a panel's text column may get before the panel stops being
 * "card plus numbers" and becomes the card itself. Below this the name wraps to
 * one word a line and the stat tiles have nowhere to sit.
 */
const MIN_PANEL_TEXT_WIDTH = 104;

/** Which starburst each stat tile draws as. */
const BADGE_STAT: Record<Exclude<StatTile["label"], "HP">, StatKey> = {
  THW: "thw",
  ATK: "atk",
  DEF: "def",
  SCH: "sch",
  REC: "rec",
};

/**
 * The design's entity card: an art band, then name + status, then a stat
 * triplet in 2px boxes (Components.dc.html, "Art band, then name + status,
 * then consequence, then a stat triplet"). A panel too short for a band
 * drops it rather than squeezing it — the compact variant in the same sheet.
 */
export function drawCharacter(ctx: BoardDrawContext, rect: Rect, panel: CharacterPanel): void {
  const { scene, controller } = ctx;
  ctx.frame.hitRects.set(panel.instanceId, rect);
  const dim = dimAlpha(controller.selection, panel.instanceId);
  // Captured before the frame is painted, because on a card-shaped panel the
  // *frame* turns with the card — it is the card's border, not a box the card
  // sits in. See `turnSideways`.
  const firstDrawn = scene.children.list.length;
  const g = scene.add.graphics();
  paintPanel(g, rect, "card", targetState(controller.selection, panel.instanceId));

  // A panel that is already roughly card-shaped *is* the card: the scan fills
  // it and the live numbers ride on top. A wider panel gives the card a
  // column down its left and the numbers the room beside it. Either way the
  // scan is never cropped — a card with its edges cut off reads as broken
  // rather than as art.
  if (rect.width < MIN_PANEL_TEXT_WIDTH + 60 || rect.width < rect.height * 0.95) {
    drawCardShapedPanel(ctx, rect, panel, dim, firstDrawn);
    return;
  }

  // As tall as the panel allows, so the card is the thing you see — capped
  // only by leaving the numbers beside it a readable column.
  const artWidth = Math.round(
    Math.min(rect.width - MIN_PANEL_TEXT_WIDTH - 14, (rect.height - 6) * CARD_ASPECT),
  );
  const artColumn: Rect | null =
    artWidth > 0
      ? { x: rect.x + 3, y: rect.y + 3, width: artWidth, height: Math.min(rect.height - 6, Math.round(artWidth / CARD_ASPECT)) }
      : null;
  if (artColumn) {
    const column = artColumn;
    drawArtSlot(ctx, column, panel.art, dim);
    const rule = scene.add.graphics();
    rule.fillStyle(surface.ink.hex, dim).fillRect(column.x + column.width, column.y, 3, column.height);
  }

  const left = rect.x + 8 + (artWidth > 0 ? artWidth + 6 : 0);
  const textWidth = Math.max(40, rect.x + rect.width - 8 - left);
  /**
   * Stats in a row beside the card, the HP plate under them, pinned to the foot
   * of the text column — never over the card on a wide panel. An identity's scan
   * is shown whole so its rules text can be read, and badges stacked over its
   * printed icons covered that text ("Spider-Sense — Interrupt…"). Laid out
   * before anything above it is placed, so the chips know where to stop.
   */
  const statBlock = statBlockLayout(
    { x: left, y: rect.y, width: textWidth, height: rect.height - 8 },
    panel.stats.filter((tile) => tile.label !== "HP").length,
    panel.hp !== null,
  );
  let top = rect.y + 6;

  const name = scene.add
    .text(left, top, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
    .setWordWrapWidth(textWidth)
    .setMaxLines(2);
  // Wrapped, not shrunk: "Alter-ego · Justice" losing "Justice" to an
  // ellipsis loses the aspect, which is a thing the player needs to know.
  const subtitle = label(scene, left, top + name.height + 4, panel.subtitle, typeRole.label, surface.ink.hex, ink.label * dim)
    .setWordWrapWidth(textWidth)
    .setMaxLines(2);
  top = subtitle.y + subtitle.height + 6;

  // The named tag is the design's default wherever there is room beside the
  // name; the corner pip is for the card-shaped panel that has none.
  top = drawStatusTags(scene, left, top, textWidth, panel, dim);
  for (const effect of panel.effects) {
    drawFootStrip(scene, { x: left, y: top, width: textWidth, height: 16 }, effect, "note", dim);
    top += 19;
  }

  if (panel.exhausted) {
    top = drawExhaustedBadge(scene, left, top, textWidth, dim);
  }
  if (panel.boostCount > 0) {
    label(scene, left, top, `boost ?? ×${panel.boostCount}`, typeRole.label, surface.ink.hex, ink.meta * dim);
    top += 14;
  }
  const abilityLine = controller.abilityLine(panel.instanceId);
  if (abilityLine) {
    drawFootStrip(scene, { x: left, y: top, width: textWidth, height: 18 }, abilityLine, "ability", dim);
    top += 22;
  }

  /**
   * Attachments hanging off this card — an upgrade on your identity, a
   * condition on an ally, an attachment on an enemy.
   *
   * These used to be name-only labels, which was reported from play as "I
   * cannot see those cards and know when I can use those upgrades" —
   * Spider-Man's two Web-Shooters sat here as two identical words. A chip is
   * still the right shape (an upgrade lives *on* its host, and giving each
   * one a card-sized slot would push the host off the table), so the fix is
   * to make the chip do the two things the player wanted:
   *
   *  - **say when it can be used**, with the same green `▶` the board already
   *    uses for an ability you can trigger right now; and
   *  - **open the card**, because the only way to read an upgrade's wording
   *    was to already know where it was.
   *
   * It is a tap target like any other card, so it also answers a target
   * prompt or a payment tap — a Web-Shooter *is* a resource for a payment,
   * and before this there was no way to spend one from the table.
   *
   * Collected, not registered here: the panel's own tap target is added at
   * the end of this function, and a later interactive zone sits higher in the
   * display list — so a chip registered now would be swallowed by the panel
   * behind it. They go on *after* it.
   */
  const chipTargets: { readonly rect: Rect; readonly instanceId: InstanceId }[] = [];
  for (const attachment of panel.attachments.slice(0, 4)) {
    if (top + 16 > rect.y + rect.height - 8 - statBlock.height - 4) break;
    const usable = controller.selection.kind === "idle" && (ctx.marks?.usableAbilities.has(attachment.instanceId) ?? false);
    const chip: Rect = { x: left, y: top, width: textWidth, height: 16 };
    const cg = scene.add.graphics();
    cg.fillStyle(surface.parchment.hex, dim).fillRect(chip.x, chip.y, chip.width, chip.height);
    cg.lineStyle(2, usable ? signal.heal.hex : surface.ink.hex, dim * (attachment.exhausted ? ink.disabled : 1))
      .strokeRect(chip.x, chip.y, chip.width, chip.height);
    fitText(
      label(
        scene,
        chip.x + 3,
        chip.y + 3,
        usable ? `▶ ${attachmentChipLabel(attachment)}` : attachmentChipLabel(attachment),
        typeRole.label,
        usable ? signal.heal.hex : surface.ink.hex,
        (usable ? ink.body : ink.label) * dim,
      ),
      chip.width - 6,
      typeRole.label.size,
    );
    chipTargets.push({ rect: chip, instanceId: attachment.instanceId });
    top += 19;
  }

  drawStatBlock(scene, statBlock, panel, dim);

  ctx.makeTapTarget(rect, panel.instanceId, () => controller.onCharacterTap(panel.instanceId));
  // After the panel, so an attachment chip wins the pointer over the host it
  // is drawn on top of.
  for (const target of chipTargets) {
    ctx.makeTapTarget(target.rect, target.instanceId, () => {
      // A tap uses it when there is something to use; otherwise it shows the
      // card, which is the other half of what was being asked for.
      if (controller.usableAbilitiesFor(target.instanceId).length > 0) controller.onCharacterTap(target.instanceId);
      else ctx.inspect(target.instanceId);
    });
  }
}

/**
 * A card-shaped panel — a minion in a row, an ally in the play area.
 *
 * The scan fills it, because the slot and the scan are the same shape and the
 * card already prints its own name and printed stats. Only what the *game*
 * knows goes on top: the statuses, and a strip carrying the numbers that
 * change (current HP, modified ATK) which the printed card cannot show.
 */
function drawCardShapedPanel(ctx: BoardDrawContext, rect: Rect, panel: CharacterPanel, dim: number, firstDrawn: number): void {
  const { scene, controller } = ctx;
  // `firstDrawn` is the caller's index, taken *before* the panel frame, so an
  // exhausted card turns frame and all. The tap target is added after the
  // rotation and stays square to the slot — see `turnSideways`.
  const inner: Rect = { x: rect.x + 3, y: rect.y + 3, width: rect.width - 6, height: rect.height - 6 };
  const key = ctx.art.request(scene, panel.art);
  if (!drawArt(scene, key, inner, { fit: "cover", alpha: dim })) {
    const ground = scene.add.graphics();
    ground.fillStyle(surface.parchment.hex, dim).fillRect(inner.x, inner.y, inner.width, inner.height);
    scene.add
      .text(inner.x + inner.width / 2, inner.y + 14, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
      .setOrigin(0.5, 0)
      .setWordWrapWidth(inner.width - 8)
      .setMaxLines(2);
  }

  drawStatusPips(scene, rect, panel, dim);

  /**
   * Strips along the foot: whose card this is when another player lent it
   * ("play under any player's control"), and what tapping it does.
   *
   * The ability line used to be bare green label text laid over the top of the
   * scan, where it fought the card's own name and cost for the same pixels and
   * lost ("▶ EXHAUST, REMOVE 1 SNOOP…" over Surveillance Team's title). A solid
   * ink strip is readable over any art, and the foot of a printed card is its
   * set line and copyright — the one band a player never reads. The stat column
   * lifts to clear them rather than share that space.
   */
  const abilityLine = rect.height >= 40 ? controller.abilityLine(panel.instanceId) : null;
  const strips: { readonly text: string; readonly tone: FootTone }[] = [];
  if (panel.ownerName && rect.height >= 40) strips.push({ text: `from ${panel.ownerName}`, tone: "note" });
  if (abilityLine) strips.push({ text: abilityLine, tone: "ability" });
  const stripHeight = Math.min(20, Math.max(14, Math.round(inner.height * 0.1)));
  const reserved = strips.length * stripHeight;

  // Live stats over the printed icons, where the eye already looks for them on
  // this card, and hit points along the foot. Same widgets as the wide panel.
  if (panel.stats.length > 0 && rect.height > 60) {
    const column = cardStatColumn(
      { ...inner, height: inner.height - reserved },
      panel.stats.filter((tile) => tile.label !== "HP").length,
      panel.hp !== null,
    );
    drawStatBlock(scene, column, panel, dim);
  }
  strips.forEach((strip, index) => {
    const y = inner.y + inner.height - reserved + index * stripHeight;
    drawFootStrip(scene, { x: inner.x, y, width: inner.width, height: stripHeight }, strip.text, strip.tone, dim);
  });

  // The card itself turns, the way it does on the table. No word needed.
  if (panel.exhausted) turnSideways(scene, rect, scene.children.list.slice(firstDrawn));

  ctx.makeTapTarget(rect, panel.instanceId, () => controller.onCharacterTap(panel.instanceId));
}

/**
 * A panel's stats, drawn into a laid-out block: a starburst per stat and the
 * hit-point plate. The wide panel and the card-shaped one share this, so a
 * hero, an ally, a minion and the villain all read their numbers one way.
 */
function drawStatBlock(scene: Phaser.Scene, block: StatBlock, panel: CharacterPanel, dim: number): void {
  panel.stats
    .filter((tile) => tile.label !== "HP")
    .forEach((tile, index) => {
      const slot = block.badges[index];
      if (!slot || tile.label === "HP") return;
      new McStatBadge(scene, {
        cx: slot.cx,
        cy: slot.cy,
        size: slot.size,
        stat: BADGE_STAT[tile.label],
        value: tile.value,
        bonus: tile.bonus,
        alpha: dim,
      });
    });
  if (block.hp && panel.hp) {
    new McHpPlate(scene, {
      rect: block.hp,
      current: panel.hp.current,
      max: panel.hp.max,
      bonus: panel.stats.find((tile) => tile.label === "HP")?.bonus ?? 0,
      alpha: dim,
      tough: panel.statuses.some(({ status }) => status === "tough"),
    });
  }
}

/**
 * Turns a card-shaped panel a quarter turn, the table's own sign for
 * exhausted (RRG "Exhaust": the card is turned sideways).
 *
 * A word in the corner was what this used to be, and it was missed in play —
 * it sat over the card's own cost and name at label size. Rotation is the
 * signal the physical game already uses, it reads at a glance from across the
 * board, and it is a *shape* cue rather than a colour one, so it satisfies
 * the design's colourblind rule without needing a second treatment.
 *
 * **The frame turns too.** A first version rotated only the contents and left
 * the panel border upright, which read as a small card adrift in a big empty
 * box — the border is the *card's* border, not a box the card sits in. The
 * whole panel is therefore in the rotated group.
 *
 * It is scaled so the turned card spans the slot's width, which keeps it from
 * reaching into its neighbours, and it stays centred on the slot so nothing
 * reflows and the tap target stays where the pointer expects it. The board
 * shows through above and below, the way a turned card leaves table visible
 * around it.
 *
 * Objects are re-parented into a container rather than each being rotated,
 * so the whole face — scan, status pips, the ink stat strip — turns as one
 * piece. That also makes this a single `rotation` to tween when the animation
 * pass lands, rather than a dozen.
 */
function turnSideways(scene: Phaser.Scene, rect: Rect, drawn: readonly Phaser.GameObjects.GameObject[]): void {
  if (drawn.length === 0) return;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const fit = Math.min(rect.width / rect.height, rect.height / rect.width);
  for (const object of drawn) {
    const placed = object as Phaser.GameObjects.GameObject & { x?: number; y?: number };
    if (typeof placed.x === "number") placed.x -= cx;
    if (typeof placed.y === "number") placed.y -= cy;
  }
  scene.add
    .container(cx, cy, [...drawn])
    .setRotation(Math.PI / 2)
    .setScale(fit);
}

/**
 * The exhausted badge, for a panel too wide to turn.
 *
 * An identity sits in a wide panel with its card in a column and its numbers
 * beside it, so turning it would turn the numbers too. It gets a filled chip
 * in the design's "spent" ink instead. Returns the next free `y`.
 */
function drawExhaustedBadge(scene: Phaser.Scene, x: number, y: number, maxWidth: number, dim: number): number {
  const caption = label(scene, 0, 0, "exhausted", typeRole.label, surface.paper.hex, dim);
  const width = Math.min(maxWidth, Math.ceil(caption.width) + 14);
  const height = Math.ceil(caption.height) + 6;
  const chip = scene.add.graphics();
  chip.fillStyle(signal.spent.hex, dim).fillRect(x, y, width, height);
  caption.setPosition(x + 7, y + 3);
  scene.children.bringToTop(caption);
  return y + height + 5;
}

/** Lettering on each status hue, as the design's token cards set it: ink on the light two, paper on violet. */
const STATUS_TEXT: Record<CharacterPanel["statuses"][number]["status"], number> = {
  stunned: surface.ink.hex,
  confused: surface.paper.hex,
  tough: surface.ink.hex,
};

/**
 * Status pips: initial only, in the hue that exists nowhere else. The design's
 * 26px pip, scaled down only for a card too small to carry one.
 */
function drawStatusPips(scene: Phaser.Scene, rect: Rect, panel: CharacterPanel, dim: number): void {
  const size = Math.max(16, Math.min(26, Math.round(rect.width * 0.2)));
  panel.statuses.forEach(({ status }, index) => {
    const pip: Rect = { x: rect.x + rect.width - size - 6 - index * (size + 4), y: rect.y + 6, width: size, height: size };
    const pg = scene.add.graphics();
    pg.fillStyle(statusTokens[status].hex, dim).fillRect(pip.x, pip.y, pip.width, pip.height);
    pg.lineStyle(2.5, surface.ink.hex, dim).strokeRect(pip.x, pip.y, pip.width, pip.height);
    scene.add
      .text(pip.x + pip.width / 2, pip.y + pip.height / 2, status.charAt(0).toUpperCase(), {
        ...textStyle(typeRole.statSmall, STATUS_TEXT[status], dim),
        fontSize: `${Math.round(size * 0.62)}px`,
      })
      .setOrigin(0.5);
  });
}

/**
 * The design's named status tag — "STUNNED" stamped in its hue with an ink
 * border — for a panel with room beside the name. Wraps to a second row
 * rather than clipping a status off. Returns the next free `y`.
 */
function drawStatusTags(scene: Phaser.Scene, x: number, y: number, maxWidth: number, panel: CharacterPanel, dim: number): number {
  if (panel.statuses.length === 0) return y;
  const height = 18;
  let cursor = x;
  let row = y;
  for (const { status, count } of panel.statuses) {
    const caption = scene.add
      .text(0, 0, `${status.toUpperCase()}${count > 1 ? ` ×${count}` : ""}`, {
        ...textStyle(typeRole.barTitle, STATUS_TEXT[status], dim),
        fontSize: "13px",
      })
      .setOrigin(0, 0.5)
      .setLetterSpacing(0.6);
    const width = Math.ceil(caption.width) + 12;
    if (cursor > x && cursor + width > x + maxWidth) {
      cursor = x;
      row += height + 4;
    }
    const tag = scene.add.graphics();
    tag.fillStyle(statusTokens[status].hex, dim).fillRect(cursor, row, width, height);
    tag.lineStyle(2, surface.ink.hex, dim).strokeRect(cursor, row, width, height);
    caption.setPosition(cursor + 6, row + height / 2 + 1);
    scene.children.bringToTop(caption);
    cursor += width + 5;
  }
  return row + height + 5;
}

type FootTone = "ability" | "note";

/**
 * One solid ink strip carrying a line the table needs read over card art: the
 * `▶` ability affordance (an accent bar in the "legal" green) or a note — who
 * lent this card, a lasting effect aimed at this seat (caution yellow).
 */
function drawFootStrip(scene: Phaser.Scene, rect: Rect, text: string, tone: FootTone, dim: number): void {
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 0.92 * dim).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(tone === "ability" ? signal.heal.hex : signal.caution.hex, dim).fillRect(rect.x, rect.y, 4, rect.height);
  const caption = label(scene, rect.x + 8, rect.y + rect.height / 2, text, typeRole.label, tone === "ability" ? surface.paper.hex : signal.caution.hex, dim).setOrigin(0, 0.5);
  // `fitText` shrinks to the design's floor and then ellipsizes, so a clipped
  // line at least admits it is clipped.
  fitText(caption, rect.width - 12, typeRole.label.size);
}

/**
 * One card slot: the whole scan when it has arrived, and the designed
 * fallback frame when it hasn't. The frame is drawn either way as the
 * ground, so a scan that loads mid-game paints over its own placeholder and
 * there is never a hole where a picture is about to be.
 */
function drawArtSlot(ctx: BoardDrawContext, slot: Rect, source: ArtSource | null, dim: number, fit: ArtFit = "contain"): void {
  const { scene } = ctx;
  const frame = scene.add.graphics();
  frame.fillStyle(surface.parchment.hex, dim).fillRect(slot.x, slot.y, slot.width, slot.height);

  const key = ctx.art.request(scene, source);
  if (!drawArt(scene, key, slot, { fit, alpha: dim }) && slot.height >= 26) {
    // The design's empty art slot: present, not filled yet.
    label(scene, slot.x + slot.width / 2, slot.y + slot.height / 2, "art", typeRole.label, surface.ink.hex, ink.meta * dim).setOrigin(0.5);
  }
}
