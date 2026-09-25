/**
 * Character panels: the villain, a minion, your identity, an ally — every card
 * on the table that carries stats.
 *
 * `drawCharacter` picks between the two shapes a panel takes: the wide panel,
 * with the card in a column and the numbers beside it, and the card-shaped
 * panel, where the scan *is* the panel and the live numbers ride on top.
 */

import { countTween } from "../../ui/bound-tween.js";
import type Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import { drawArt, type ArtFit } from "../../art/card-art.js";
import type { ArtSource } from "../../art/art-source.js";
import { accent, ink, signal, status as statusTokens, surface, typeRole } from "../../tokens.js";
import { textStyle } from "../../ui/theme.js";
import { McHpPlate, McStatBadge, fitText, label, paintPanel, type StatKey } from "../../ui/widgets.js";
import { attachmentChipLabel, type CharacterPanel, type StatTile } from "../../view/board-model.js";
import { hpFromValue } from "../../view/hp-motion.js";
import {
  CARD_ASPECT,
  PANEL_TEXT_INSETS,
  PANEL_TEXT_MIN_WIDTH,
  cardStatColumn,
  panelShape,
  statBlockLayout,
  type PanelShape,
  type Rect,
  type StatBlock,
} from "../../view/layout.js";
import type { StatusName } from "../../view/log-lines.js";
import { lerp } from "../../view/motion-math.js";
import type { BoardDrawContext } from "./context.js";
import type { DefeatFlashState, ExhaustMotionState, HpTickState, StatusStampState } from "./motion.js";
import { dimAlpha, targetState } from "./selection.js";

export interface DrawCharacterOptions {
  /**
   * Which shape the panel takes. `"auto"` (the default) reads the rect —
   * right for a slot from `cardRow`. The identity panel passes `"wide"`,
   * because it is the one panel whose attachments and rules text the player
   * has to be able to read whatever shape the window gives its slot
   * (`panelShape` in `view/layout.ts`).
   */
  readonly shape?: PanelShape | "auto";
}

/** "1 time" / "2 time, 1 snoop" — every counter kind on the card itself, in one short line. */
function counterLine(counters: CharacterPanel["counters"]): string {
  return counters.map((counter) => `${counter.count} ${counter.name}`).join(", ");
}

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
export function drawCharacter(
  ctx: BoardDrawContext,
  rect: Rect,
  panel: CharacterPanel,
  options: DrawCharacterOptions = {},
): void {
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
  // rather than as art. The identity asks for the wide panel outright, since
  // a tall window can hand it a slot that *looks* card-shaped.
  if (panelShape(rect, options.shape) === "card") {
    drawCardShapedPanel(ctx, rect, panel, dim, firstDrawn);
    return;
  }

  // As tall as the panel allows, so the card is the thing you see — capped
  // only by leaving the numbers beside it a readable column. `PANEL_TEXT_INSETS`
  // is exactly the frame inset, gap and text inset spent below, so the column
  // that is left really is `PANEL_TEXT_MIN_WIDTH` wide, not 8px short of it.
  const artWidth = Math.max(
    0,
    Math.round(Math.min(rect.width - PANEL_TEXT_MIN_WIDTH - PANEL_TEXT_INSETS, (rect.height - 6) * CARD_ASPECT)),
  );
  const artColumn: Rect | null =
    artWidth > 0
      ? {
          x: rect.x + 3,
          y: rect.y + 3,
          width: artWidth,
          height: Math.min(rect.height - 6, Math.round(artWidth / CARD_ASPECT)),
        }
      : null;
  if (artColumn) {
    const column = artColumn;
    drawArtSlot(ctx, column, panel.art, dim);
    const rule = scene.add.graphics();
    rule.fillStyle(surface.ink.hex, dim).fillRect(column.x + column.width, column.y, 3, column.height);
  }

  const left = rect.x + 8 + (artWidth > 0 ? artWidth + 6 : 0);
  const textWidth = Math.max(40, rect.x + rect.width - 8 - left);
  let top = rect.y + 6;

  const name = scene.add
    .text(left, top, panel.name, textStyle(typeRole.rowTitle, surface.ink.hex, dim))
    .setWordWrapWidth(textWidth)
    .setMaxLines(2);
  // Wrapped, not shrunk: "Alter-ego · Justice" losing "Justice" to an
  // ellipsis loses the aspect, which is a thing the player needs to know.
  const subtitle = label(
    scene,
    left,
    top + name.height + 4,
    panel.subtitle,
    typeRole.label,
    surface.ink.hex,
    ink.label * dim,
  )
    .setWordWrapWidth(textWidth)
    .setMaxLines(2);
  top = subtitle.y + subtitle.height + 6;

  // The named tag is the design's default wherever there is room beside the
  // name; the corner pip is for the card-shaped panel that has none.
  top = drawStatusTags(ctx, left, top, textWidth, panel, dim);
  for (const effect of panel.effects) {
    drawFootStrip(scene, { x: left, y: top, width: textWidth, height: 16 }, effect, "note", dim);
    top += 19;
  }

  if (panel.exhausted) {
    const badgeFirstDrawn = scene.children.list.length;
    top = drawExhaustedBadge(scene, left, top, textWidth, dim);
    // A fade-in right when it just landed. There's no matching fade-out for
    // the moment it clears — the badge simply isn't drawn once `panel.exhausted`
    // is false, and animating that would mean reserving its layout space for a
    // widget the fresh model no longer has one, which is a bigger change than
    // this pass calls for.
    const exhaustMotion = ctx.motion.exhaustMotion(panel.instanceId);
    if (exhaustMotion?.direction === "exhausting")
      animateAlphaFrom(scene, scene.children.list.slice(badgeFirstDrawn), exhaustMotion);
  }
  if (panel.boostCount > 0) {
    label(scene, left, top, `boost ?? ×${panel.boostCount}`, typeRole.label, surface.ink.hex, ink.meta * dim);
    top += 14;
  }
  if (panel.counters.length > 0) {
    label(scene, left, top, counterLine(panel.counters), typeRole.label, surface.ink.hex, ink.meta * dim);
    top += 14;
  }
  const abilityLine = controller.abilityLine(panel.instanceId);
  if (abilityLine) {
    drawFootStrip(scene, { x: left, y: top, width: textWidth, height: 18 }, abilityLine, "ability", dim);
    top += 22;
  }

  /**
   * Stats in a row beside the card, the HP plate under them, pinned to the foot
   * of the text column — never over the card on a wide panel. An identity's scan
   * is shown whole so its rules text can be read, and badges stacked over its
   * printed icons covered that text ("Spider-Sense — Interrupt…").
   *
   * Laid out here, against what's actually left below the header (`top`) rather
   * than the column's full height from `rect.y` — a villain's fixed, short
   * panel height gave a max-size two-stat badge row + HP plate no room to sit
   * under "Villain · Stage II" without also reaching up over it, and since this
   * used to be laid out (and drawn) before the header, the badges painted right
   * over that subtitle.
   */
  const statBlock = statBlockLayout(
    { x: left, y: top, width: textWidth, height: Math.max(0, rect.y + rect.height - 8 - top) },
    panel.stats.filter((tile) => tile.label !== "HP").length,
    panel.hp !== null,
  );

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
    if (top + 16 > statBlock.top - 4) break;
    const usable =
      controller.selection.kind === "idle" && (ctx.marks?.usableAbilities.has(attachment.instanceId) ?? false);
    const chip: Rect = { x: left, y: top, width: textWidth, height: 16 };
    const cg = scene.add.graphics();
    cg.fillStyle(surface.parchment.hex, dim).fillRect(chip.x, chip.y, chip.width, chip.height);
    cg.lineStyle(
      2,
      usable ? signal.heal.hex : surface.ink.hex,
      dim * (attachment.exhausted ? ink.disabled : 1),
    ).strokeRect(chip.x, chip.y, chip.width, chip.height);
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

  drawStatBlock(ctx, statBlock, panel, dim);

  // The whole panel nudges on damage and flashes on defeat, the same as a
  // card-shaped panel (`drawCardShapedPanel`) — wrapped from `firstDrawn`, so
  // it also catches the art column, header and attachment chips above.
  nudgeOnDamage(scene, firstDrawn, ctx.motion.hpTick(panel.instanceId));
  drawDefeatFlash(scene, rect, ctx.motion.defeatFlash(panel.instanceId));

  ctx.makeTapTarget(rect, panel.instanceId, () => controller.onCharacterTap(panel.instanceId));
  // After the panel, so an attachment chip wins the pointer over the host it
  // is drawn on top of.
  for (const target of chipTargets) {
    // A tap shows the card; its sheet offers any ability it has, so nothing is used by a stray tap.
    ctx.makeTapTarget(target.rect, target.instanceId, () => controller.onCharacterTap(target.instanceId));
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
function drawCardShapedPanel(
  ctx: BoardDrawContext,
  rect: Rect,
  panel: CharacterPanel,
  dim: number,
  firstDrawn: number,
): void {
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

  drawStatusPips(ctx, rect, panel, dim);

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
  // Counters the card itself holds — Quinjet's time counters (`03019`), the
  // reason it has a support-shaped slot in the play area at all: "put an
  // Avenger ally into play with cost <= the number of time counters on
  // Quinjet" reads as broken when nothing on the table ever says how many
  // there are (PLAN.md Phase 7, "the board has to show counters on a support").
  if (panel.counters.length > 0 && rect.height >= 40) strips.push({ text: counterLine(panel.counters), tone: "note" });
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
    drawStatBlock(ctx, column, panel, dim);
  }
  strips.forEach((strip, index) => {
    const y = inner.y + inner.height - reserved + index * stripHeight;
    drawFootStrip(scene, { x: inner.x, y, width: inner.width, height: stripHeight }, strip.text, strip.tone, dim);
  });

  // A brief ±4px shake on damage, wrapping everything drawn so far — the
  // exhaust turn below re-parents this same span again if both land in the
  // same command, so a hit that also exhausts its target nudges, then turns,
  // as one container inside another.
  nudgeOnDamage(scene, firstDrawn, ctx.motion.hpTick(panel.instanceId));

  // The card itself turns, the way it does on the table. No word needed.
  const exhaustMotion = ctx.motion.exhaustMotion(panel.instanceId);
  if (panel.exhausted || exhaustMotion)
    turnSideways(scene, rect, scene.children.list.slice(firstDrawn), panel.exhausted, exhaustMotion);

  drawDefeatFlash(scene, rect, ctx.motion.defeatFlash(panel.instanceId));

  ctx.makeTapTarget(rect, panel.instanceId, () => controller.onCharacterTap(panel.instanceId));
}

/**
 * A panel's stats, drawn into a laid-out block: a starburst per stat and the
 * hit-point plate. The wide panel and the card-shaped one share this, so a
 * hero, an ally, a minion and the villain all read their numbers one way.
 *
 * The HP plate's number counts from its old value when a fresh
 * `damageDealt`/`damagePlaced`/`damageHealed` landed on this card: a tween on
 * a plain driver object calls `McHpPlate.update()` every step, which also
 * slides the plate's own meter since `update()` re-runs its whole `redraw()`.
 * `hitPointsSet` is excluded — it carries no delta to count from, so it just
 * shows its new value, same as always.
 */
function drawStatBlock(ctx: BoardDrawContext, block: StatBlock, panel: CharacterPanel, dim: number): void {
  const { scene } = ctx;
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
    const plate = new McHpPlate(scene, {
      rect: block.hp,
      current: panel.hp.current,
      max: panel.hp.max,
      bonus: panel.stats.find((tile) => tile.label === "HP")?.bonus ?? 0,
      alpha: dim,
      tough: panel.statuses.some(({ status }) => status === "tough"),
    });

    const tick = ctx.motion.hpTick(panel.instanceId);
    if (tick && tick.tick.kind !== "set") {
      // Tied to the plate: the next redraw destroys it, and a counter still writing into it would throw inside
      // Phaser's frame and stop the game (`ui/bound-tween.ts`).
      countTween(scene, plate.container, {
        from: hpFromValue(panel.hp.current, tick.tick),
        to: panel.hp.current,
        durationMs: tick.remainingMs,
        onStep: (value) => plate.update({ current: Math.round(value) }),
      });
    }
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
 * piece, and rotation/scale are a single tween on that container.
 *
 * `active` is the in-progress turn a fresh `cardExhausted`/`cardReadied`
 * carries (`BoardMotion#exhaustMotion`): rotation runs 0 -> π/2 while scale
 * runs 1 -> `fit` turning in, and the reverse turning out, both recomputed
 * from `active.progress` so a redraw mid-turn resumes rather than restarts.
 * With no `active` motion — a redraw this event didn't cause, or the card was
 * already exhausted at the start of this session — it lands directly at its
 * steady state, exactly as this function used to always do.
 */
function turnSideways(
  scene: Phaser.Scene,
  rect: Rect,
  drawn: readonly Phaser.GameObjects.GameObject[],
  exhausted: boolean,
  active: ExhaustMotionState | null,
): void {
  if (drawn.length === 0) return;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const fit = Math.min(rect.width / rect.height, rect.height / rect.width);
  // The pivot is an inner container offset by the centre, not a shift of each object's own x/y: one of those
  // objects is `nudgeOnDamage`'s container, whose running tween drives its x back to 0 — so an ally that took
  // consequential damage and exhausted in one attack lost the shift, and the quarter turn carried that into a drop
  // of half the board's width, off the bottom of the play area (reported from play, Daredevil on a phone).
  const pivot = scene.add.container(-cx, -cy, [...drawn]);
  const container = scene.add.container(cx, cy, [pivot]);

  if (!active) {
    container.setRotation(exhausted ? Math.PI / 2 : 0).setScale(exhausted ? fit : 1);
    return;
  }

  const turningIn = active.direction === "exhausting";
  const fromRotation = turningIn ? 0 : Math.PI / 2;
  const toRotation = turningIn ? Math.PI / 2 : 0;
  const fromScale = turningIn ? 1 : fit;
  const toScale = turningIn ? fit : 1;
  container
    .setRotation(lerp(fromRotation, toRotation, active.progress))
    .setScale(lerp(fromScale, toScale, active.progress));
  scene.tweens.add({
    targets: container,
    rotation: toRotation,
    scale: toScale,
    duration: active.remainingMs,
    ease: "Quad.easeInOut",
  });
}

/**
 * A brief ±4px horizontal shake — everything drawn for this panel since
 * `firstDrawn`, re-parented into a container the same way `turnSideways`
 * re-parents the whole face — right after a fresh `damageDealt`/`damagePlaced`
 * landed on this card. A heal or a dial-set (`hitPointsSet`) doesn't nudge.
 */
function nudgeOnDamage(scene: Phaser.Scene, firstDrawn: number, tick: HpTickState | null): void {
  if (!tick || tick.tick.kind !== "damage") return;
  const drawn = scene.children.list.slice(firstDrawn);
  if (drawn.length === 0) return;
  const container = scene.add.container(0, 0, [...drawn]);
  scene.tweens.add({ targets: container, x: { from: -4, to: 0 }, duration: tick.remainingMs, ease: "Sine.easeOut" });
}

/**
 * A Hero Red stroke around the panel, fading out, for a character just
 * defeated. Drawn as its own overlay rather than folded into the nudge/turn
 * containers above, since a defeated card is usually about to leave play —
 * the flash has nothing to travel with.
 */
function drawDefeatFlash(scene: Phaser.Scene, rect: Rect, flash: DefeatFlashState | null): void {
  if (!flash) return;
  const g = scene.add.graphics();
  g.lineStyle(4, accent.heroRed.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
  g.setAlpha(1 - flash.progress);
  scene.tweens.add({
    targets: g,
    alpha: 0,
    duration: flash.remainingMs,
    ease: "Quad.easeOut",
    onComplete: () => g.destroy(),
  });
}

/** A plain 0 -> 1 alpha fade-in for objects drawn since `firstDrawn` are already `drawn`, resuming from `state.progress`. */
function animateAlphaFrom(
  scene: Phaser.Scene,
  drawn: readonly Phaser.GameObjects.GameObject[],
  state: { readonly progress: number; readonly remainingMs: number },
): void {
  if (drawn.length === 0) return;
  const container = scene.add.container(0, 0, [...drawn]);
  container.setAlpha(lerp(0, 1, state.progress));
  scene.tweens.add({ targets: container, alpha: 1, duration: state.remainingMs, ease: "Quad.easeOut" });
}

/**
 * A status pip/tag settling onto the table (`"in"`, `statusGiven` — scale 1.6
 * -> 1 with a slight rotation settle) or fading off it (`"out"`,
 * `statusRemoved` — a plain alpha fade). The same re-parenting trick
 * `turnSideways` uses, pinned to the pip/tag's own center rather than the
 * whole card's, so more than one status on the same card each settle on
 * their own clock without disturbing the others.
 */
function stampFade(
  scene: Phaser.Scene,
  firstDrawn: number,
  pinRect: Rect,
  state: StatusStampState,
  kind: "in" | "out",
): void {
  const drawn = scene.children.list.slice(firstDrawn);
  if (drawn.length === 0) return;
  const cx = pinRect.x + pinRect.width / 2;
  const cy = pinRect.y + pinRect.height / 2;
  for (const object of drawn) {
    const placed = object as Phaser.GameObjects.GameObject & { x?: number; y?: number };
    if (typeof placed.x === "number") placed.x -= cx;
    if (typeof placed.y === "number") placed.y -= cy;
  }
  const container = scene.add.container(cx, cy, [...drawn]);

  if (kind === "in") {
    container
      .setScale(lerp(1.6, 1, state.progress))
      .setRotation(lerp(-0.2, 0, state.progress))
      .setAlpha(lerp(0, 1, state.progress));
    scene.tweens.add({
      targets: container,
      scale: 1,
      rotation: 0,
      alpha: 1,
      duration: state.remainingMs,
      ease: "Back.easeOut",
    });
    return;
  }

  container.setAlpha(1 - state.progress);
  scene.tweens.add({
    targets: container,
    alpha: 0,
    duration: state.remainingMs,
    ease: "Quad.easeOut",
    onComplete: () => container.destroy(),
  });
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

/** A real status pip/tag, plus the ghosts of any just-removed ones not already among the real ones — the shared list both `drawStatusPips` and `drawStatusTags` lay out. */
function statusEntries(
  ctx: BoardDrawContext,
  panel: CharacterPanel,
): readonly { readonly status: StatusName; readonly count: number; readonly ghost: StatusStampState | null }[] {
  const ghosts = ctx.motion
    .statusGhosts(panel.instanceId)
    .filter((ghost) => !panel.statuses.some((pip) => pip.status === ghost.status));
  return [
    ...panel.statuses.map((pip) => ({ status: pip.status, count: pip.count, ghost: null })),
    ...ghosts.map((ghost) => ({
      status: ghost.status,
      count: 1,
      ghost: { progress: ghost.progress, remainingMs: ghost.remainingMs },
    })),
  ];
}

/**
 * Status pips: initial only, in the hue that exists nowhere else. The design's
 * 26px pip, scaled down only for a card too small to carry one.
 *
 * A freshly given status stamps on (scale 1.6 -> 1 with a rotation settle); a
 * freshly removed one draws a ghost pip here — it is already gone from
 * `panel.statuses` by the time this runs — fading out over the same window.
 */
function drawStatusPips(ctx: BoardDrawContext, rect: Rect, panel: CharacterPanel, dim: number): void {
  const { scene } = ctx;
  const size = Math.max(16, Math.min(26, Math.round(rect.width * 0.2)));
  statusEntries(ctx, panel).forEach(({ status, ghost }, index) => {
    const pip: Rect = {
      x: rect.x + rect.width - size - 6 - index * (size + 4),
      y: rect.y + 6,
      width: size,
      height: size,
    };
    const firstDrawn = scene.children.list.length;
    const pg = scene.add.graphics();
    pg.fillStyle(statusTokens[status].hex, dim).fillRect(pip.x, pip.y, pip.width, pip.height);
    pg.lineStyle(2.5, surface.ink.hex, dim).strokeRect(pip.x, pip.y, pip.width, pip.height);
    scene.add
      .text(pip.x + pip.width / 2, pip.y + pip.height / 2, status.charAt(0).toUpperCase(), {
        ...textStyle(typeRole.statSmall, STATUS_TEXT[status], dim),
        fontSize: `${Math.round(size * 0.62)}px`,
      })
      .setOrigin(0.5);

    if (ghost) {
      stampFade(scene, firstDrawn, pip, ghost, "out");
    } else {
      const stamp = ctx.motion.statusStamp(panel.instanceId, status);
      if (stamp) stampFade(scene, firstDrawn, pip, stamp, "in");
    }
  });
}

/**
 * The design's named status tag — "STUNNED" stamped in its hue with an ink
 * border — for a panel with room beside the name. Wraps to a second row
 * rather than clipping a status off. Returns the next free `y`.
 *
 * Stamps in and ghosts out the same way `drawStatusPips` does, for the wide
 * panel's tag row.
 */
function drawStatusTags(
  ctx: BoardDrawContext,
  x: number,
  y: number,
  maxWidth: number,
  panel: CharacterPanel,
  dim: number,
): number {
  const { scene } = ctx;
  const entries = statusEntries(ctx, panel);
  if (entries.length === 0) return y;
  const height = 18;
  let cursor = x;
  let row = y;
  for (const { status, count, ghost } of entries) {
    const firstDrawn = scene.children.list.length;
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

    const tagRect: Rect = { x: cursor, y: row, width, height };
    if (ghost) {
      stampFade(scene, firstDrawn, tagRect, ghost, "out");
    } else {
      const stamp = ctx.motion.statusStamp(panel.instanceId, status);
      if (stamp) stampFade(scene, firstDrawn, tagRect, stamp, "in");
    }

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
export function drawFootStrip(scene: Phaser.Scene, rect: Rect, text: string, tone: FootTone, dim: number): void {
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 0.92 * dim).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.fillStyle(tone === "ability" ? signal.heal.hex : signal.caution.hex, dim).fillRect(rect.x, rect.y, 4, rect.height);
  const caption = label(
    scene,
    rect.x + 8,
    rect.y + rect.height / 2,
    text,
    typeRole.label,
    tone === "ability" ? surface.paper.hex : signal.caution.hex,
    dim,
  ).setOrigin(0, 0.5);
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
function drawArtSlot(
  ctx: BoardDrawContext,
  slot: Rect,
  source: ArtSource | null,
  dim: number,
  fit: ArtFit = "contain",
): void {
  const { scene } = ctx;
  const frame = scene.add.graphics();
  frame.fillStyle(surface.parchment.hex, dim).fillRect(slot.x, slot.y, slot.width, slot.height);

  const key = ctx.art.request(scene, source);
  if (!drawArt(scene, key, slot, { fit, alpha: dim }) && slot.height >= 26) {
    // The design's empty art slot: present, not filled yet.
    label(
      scene,
      slot.x + slot.width / 2,
      slot.y + slot.height / 2,
      "art",
      typeRole.label,
      surface.ink.hex,
      ink.meta * dim,
    ).setOrigin(0.5);
  }
}
