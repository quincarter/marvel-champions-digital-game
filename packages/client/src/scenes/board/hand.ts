/**
 * The player's hand: the row of cards, its scroll on the tabbed board, and each
 * card's face — full, collapsed to a spine, or the generated fallback.
 */

import type Phaser from "phaser";
import type { ResourceIconType } from "@mc/content";
import { cardOf, type GameState, type InstanceId } from "@mc/engine";
import { artFor } from "../../art/art-source.js";
import { drawArt } from "../../art/card-art.js";
import { appSession } from "../../session.js";
import { accent, hit, ink, signal, surface, typeRole } from "../../tokens.js";
import { caseOf, cssOf, textStyle } from "../../ui/theme.js";
import { McSelectionRing, fitText, label, paintPanel } from "../../ui/widgets.js";
import { faceOf, type BoardModel, type HandCardView } from "../../view/board-model.js";
import type { DiscardChoiceView } from "../../view/discard-choice-model.js";
import { HandScroll, showsFanToggle } from "../../view/hand-scroll.js";
import type { IllegalReason } from "../../view/highlights.js";
import { handRow, type HandRowLayout } from "../../view/hand-row.js";
import type { Rect } from "../../view/layout.js";
import type { PaymentView } from "../../view/payment-model.js";
import type { BoardDrawContext } from "./context.js";
import { drawControllerBar } from "./controller-bar.js";
import { drawDiscardBar } from "./discard-bar.js";
import { drawPaymentBar } from "./payment-bar.js";
import { drawMyPiles } from "./piles.js";
import { focusKey } from "./selection.js";
import { addTapTarget } from "./tap-target.js";

export { HandScroll } from "../../view/hand-scroll.js";

/** The hand's caption row height off the tabbed board, or on it with no fan toggle to make room for. */
const HAND_CAPTION_HEIGHT = 20;
/**
 * The caption row's height on the tabbed board: taller than `HAND_CAPTION_HEIGHT` so `drawFanToggle`'s touch target
 * fits without crowding the card row under it — see that function's own comment for the touch-target story.
 */
const FAN_TOGGLE_CAPTION_HEIGHT = 30;

/**
 * The hand row. On the tabbed board (`Board - Phone`) a crowded hand fans
 * instead of shrinking below a readable size: full-size cards for as many
 * as fit, the rest collapsed to spines, the whole row scrollable by wheel
 * or drag, with a "Fan out" pill to trade the spines for more scrolling in
 * exchange for every card being immediately readable (PLAN.md Phase 4,
 * "the phone hand crowds at six cards"). The long table never crowds this
 * badly at any realistic hand size, so it keeps the older shrink-and-
 * overlap row (`cardRow`'s default).
 */
export function drawHand(ctx: BoardDrawContext, rect: Rect, model: BoardModel): void {
  const { scene, hand, tabbed } = ctx;
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);

  // While paying, or choosing a discard cost, the caption line gives way to
  // that mode's bar: the hand is the instrument of the decision, so the count
  // belongs directly over it. The two modes are mutually exclusive — only one
  // `Selection` is ever open at a time (`board/selection.ts`).
  const payment = ctx.controller.paymentView();
  const discard = ctx.controller.discardChoiceView();
  const controllerChoice = ctx.controller.controllerChoice();
  // The caption row's own height: taller on the tabbed board, where it also carries the fan toggle, so that pill
  // has room for a touch target closer to the design's 44px minimum than its old 14px (`drawFanToggle`) without
  // crowding into the card row under it.
  let top = rect.y + (tabbed ? FAN_TOGGLE_CAPTION_HEIGHT : HAND_CAPTION_HEIGHT);
  if (controllerChoice) {
    drawControllerBar(ctx, { x: rect.x, y: rect.y, width: rect.width, height: hit.target }, controllerChoice);
    top = rect.y + hit.target + 4;
  } else if (payment) {
    drawPaymentBar(ctx, { x: rect.x, y: rect.y, width: rect.width, height: hit.target }, payment);
    top = rect.y + hit.target + 4;
  } else if (discard) {
    drawDiscardBar(ctx, { x: rect.x, y: rect.y, width: rect.width, height: hit.target }, discard);
    top = rect.y + hit.target + 4;
  } else {
    label(
      scene,
      rect.x + 10,
      rect.y + 4,
      // The deck and discard counts moved onto the piles themselves (`piles.ts`).
      `hand ${model.hand.length}`,
      typeRole.label,
      surface.paper.hex,
      ink.label,
    );
  }

  const inner: Rect = { x: rect.x + 10, y: top, width: rect.width - 20, height: rect.y + rect.height - top - 8 };
  const fan: boolean | "expanded" = tabbed ? (hand.fannedOut ? "expanded" : true) : false;
  const row = handRow(inner, {
    handCount: model.hand.length,
    tableTiles: payment ? paymentTileCount(payment) : 0,
    fan,
    piles: tabbed ? "stacked" : "flank",
  });
  const { slots } = row;
  if (payment) drawPaymentTable(ctx, row, payment);

  const rowRight = slots.reduce((max, slot) => Math.max(max, slot.x + slot.width), row.cardArea.x);
  hand.measure(row.cardArea, rowRight);

  // The pill only earns its place once there's something to fan or unfan (a
  // hand that already fits has nothing to expand and nowhere to scroll), and
  // never while another bar already owns this same strip — `barOpen` used to
  // check `payment` alone, so the pill kept drawing over a discard-cost pick
  // or a "play under whose control" choice's own bar too.
  if (showsFanToggle(tabbed, controllerChoice !== null || payment !== null || discard !== null, hand.canScroll, hand.fannedOut)) {
    drawFanToggle(ctx, rect);
  }

  model.hand.forEach((card, index) => {
    const slot = slots[index];
    if (!slot) return;
    const drawn: Rect = { ...slot, x: slot.x - hand.scrollX };
    ctx.frame.hitRects.set(card.instanceId, drawn);
    ctx.frame.focusRects.set(focusKey({ kind: "card", instanceId: card.instanceId }), drawn);
    if (slot.kind === "spine") drawHandSpine(ctx, drawn, card, index, payment, discard);
    else drawHandCard(ctx, drawn, card, payment, discard);
  });

  // After the cards: on the tabbed board the hand scrolls, and a scrolled card
  // should slide under the pile column rather than across it.
  const backing: Rect | null = tabbed ? { x: rect.x, y: top, width: row.cardArea.x - rect.x, height: rect.y + rect.height - top } : null;
  drawMyPiles(ctx, row, model, backing);
}

/**
 * The tabbed hand's "Fan out" pill (`Board - Phone`): toggles between the
 * default row (full-size cards for as many as fit, the rest collapsed to
 * spines) and every card shown full-size, both scrollable. An outlined chip
 * rather than a filled button, the design's own language for a toggle
 * rather than a committing action.
 *
 * Reported from play (2026-09-17): the pill was there, then "disappeared and
 * never came back" as the hand emptied and refilled across a round. The
 * show/hide rule itself checks out under test (`view/hand-scroll.test.ts`) —
 * this was the actual defect: a 62×14px chip, its own raw `zone.on("pointerup"
 * ...)` with no down/up pairing, sitting in a 20px-tall strip alongside the
 * "HAND N" caption. Fourteen pixels is a third of the design's own 44px
 * touch-target floor (`tokens.ts`'s `hit.target`); missing it by a few
 * pixels landed on the hand card behind it instead (`Inspect`'s sheet,
 * unrelated to fanning), which reads exactly like "the button doesn't work."
 *
 * Fixed two ways: the chip itself is bigger and legible (`CHIP` below), and
 * its actual tap target is bigger still — padded well past the drawn chip
 * on every side, the same generous-hit-area-around-a-small-visual pattern a
 * phone's own controls use — registered through `addTapTarget`, the one tap
 * primitive every other card and control on this board already answers to,
 * rather than a bespoke listener with none of its down/up or hold handling.
 * `FAN_TOGGLE_CAPTION_HEIGHT` gives this strip the extra height the padded
 * zone needs; it still falls short of a full 44px given how little vertical
 * room a caption row has to give without crowding the cards under it — a
 * later pass could move this control off the caption row entirely to close
 * that last gap.
 */
function drawFanToggle(ctx: BoardDrawContext, handRect: Rect): void {
  const { scene, hand } = ctx;
  const chip: Rect = { x: handRect.x + handRect.width - 92, y: handRect.y + 4, width: 84, height: 22 };
  const g = scene.add.graphics();
  g.lineStyle(2, surface.paper.hex, 1).strokeRect(chip.x, chip.y, chip.width, chip.height);
  scene.add
    .text(chip.x + chip.width / 2, chip.y + chip.height / 2, (hand.fannedOut ? "Collapse" : "Fan out").toUpperCase(), textStyle(typeRole.label, surface.paper.hex))
    .setOrigin(0.5)
    .setLetterSpacing(typeRole.label.letterSpacing);

  // The actual tap target: padded out from the chip on every side, clamped to the caption row's own band —
  // `FAN_TOGGLE_CAPTION_HEIGHT` — so it never reaches up into whichever tab's own content is on screen above it,
  // nor down into the card row's first slot below it.
  const pad = 8;
  const band: Rect = { x: handRect.x, y: handRect.y, width: handRect.width, height: FAN_TOGGLE_CAPTION_HEIGHT };
  const zoneTop = Math.max(band.y, chip.y - pad);
  const zoneBottom = Math.min(band.y + band.height, chip.y + chip.height + pad);
  const zone: Rect = { x: chip.x - pad, y: zoneTop, width: chip.width + pad * 2, height: zoneBottom - zoneTop };
  addTapTarget(scene, zone, { onTap: () => hand.toggleFan(), onInspect: () => hand.toggleFan() });
}

/**
 * The half of a payment that isn't in the hand, drawn at the head of the hand
 * row: a card in play whose ability is being paid for, then every resource
 * ability on the table (Peter Parker's Scientist, Pepper Potts).
 *
 * Tapping the card in its own zone already spends it, but the hand is the only
 * zone every layout shows — on a phone the one resource that makes a card
 * affordable would otherwise sit on a tab you aren't looking at. Where the
 * tiles go is `view/hand-row.ts`'s decision, made together with the hand's.
 *
 * Deliberately not registered in `hitRects`: that map says where a card *is*
 * on the table, for beats and travels, and this tile is a stand-in. The focus
 * rect is registered, so keyboard focus lands here, where it's always visible.
 */
function drawPaymentTable(ctx: BoardDrawContext, row: HandRowLayout, payment: PaymentView): void {
  const { scene } = ctx;
  const game = appSession().store.state.game;
  if (!game) return;
  const subject = payment.subject !== null && !payment.subjectInHand ? payment.subject : null;
  const tiles = [...row.tiles];

  const subjectTile = subject ? tiles.shift() : undefined;
  if (subject && subjectTile) {
    const tile = subjectTile;
    drawTableTile(ctx, tile, game, subject, "selected");
    tableTag(scene, tile, "paying for", accent.heroRed.hex, "top");
    const ring = new McSelectionRing(scene);
    ring.show(tile, "static", true);
    ctx.frame.rings.push(ring);
  }

  payment.tableSources.forEach((source, index) => {
    const tile = tiles[index];
    if (!tile) return;
    drawTableTile(ctx, tile, game, source.instanceId, source.spent ? "selected" : "rest");
    if (source.spent) {
      const wash = scene.add.graphics();
      wash.fillStyle(surface.ink.hex, 0.3).fillRect(tile.x + 3, tile.y + 3, tile.width - 6, tile.height - 6);
    }
    tableTag(scene, tile, source.spent ? "spent" : "in play", surface.ink.hex, "top");
    tableTag(scene, tile, poolText(source.pool), signal.cost.hex, "bottom");
    ctx.frame.focusRects.set(focusKey({ kind: "card", instanceId: source.instanceId }), tile);
    // By option, not by card: a card offering two resource abilities is two tiles.
    addTapTarget(scene, tile, {
      onTap: () => ctx.controller.togglePaymentOption(source.optionId),
      onInspect: () => ctx.inspect(source.instanceId),
    });
  });

  if (row.rule) {
    const rule = scene.add.graphics();
    rule.fillStyle(surface.paper.hex, ink.meta).fillRect(row.rule.x, row.rule.y, row.rule.width, row.rule.height);
  }
}

/** How many strip tiles a payment needs: the in-play subject (an ability's cost), then each table source. */
function paymentTileCount(payment: PaymentView): number {
  return payment.tableSources.length + (payment.subject !== null && !payment.subjectInHand ? 1 : 0);
}

/** A table card in the payment strip: its current face, whole, in a card frame. */
function drawTableTile(ctx: BoardDrawContext, tile: Rect, game: GameState, id: InstanceId, state: "rest" | "selected"): void {
  const { scene } = ctx;
  const g = scene.add.graphics();
  paintPanel(g, tile, "card", state);
  const inner: Rect = { x: tile.x + 3, y: tile.y + 3, width: tile.width - 6, height: tile.height - 6 };
  const card = cardOf(game, id);
  const art = card ? artFor(card, faceOf(game, id)) : null;
  if (!drawArt(scene, ctx.art.request(scene, art), inner, { fit: "contain" })) {
    const ground = scene.add.graphics();
    ground.fillStyle(surface.parchment.hex, 1).fillRect(inner.x, inner.y, inner.width, inner.height);
    fitText(
      scene.add.text(inner.x + 3, inner.y + 18, card?.name ?? "Card", textStyle(typeRole.label, surface.ink.hex)),
      inner.width - 6,
      typeRole.label.size,
    );
  }
}

/** A one-word tag inside a strip tile, the same chip the hand's cards carry. */
function tableTag(scene: Phaser.Scene, tile: Rect, text: string, ground: number, edge: "top" | "bottom"): void {
  const tag = scene.add
    .text(tile.x + tile.width - 3, edge === "top" ? tile.y + 4 : tile.y + tile.height - 4, caseOf(typeRole.label, text), textStyle(typeRole.label, surface.paper.hex))
    .setOrigin(1, edge === "top" ? 0 : 1)
    .setLetterSpacing(typeRole.label.letterSpacing)
    .setPadding(4, 2, 4, 2)
    .setBackgroundColor(cssOf(ground));
  fitText(tag, tile.width - 6, typeRole.label.size);
}

/** What a source adds, with the type carried by its glyph: "+1M", "+1*". */
function poolText(pool: Readonly<Record<ResourceIconType, number>>): string {
  const parts = (Object.keys(RESOURCE_GLYPH) as ResourceIconType[])
    .filter((type) => pool[type] > 0)
    .map((type) => `${pool[type]}${RESOURCE_GLYPH[type]}`);
  return parts.length > 0 ? `+${parts.join(" ")}` : "+0";
}

/** How a hand card reads right now, playing or paying. */
interface HandCardState {
  readonly spent: boolean;
  readonly subject: boolean;
  readonly alpha: number;
}

/**
 * Paints a hand slot's frame for its state, and rings the card being paid for.
 *
 * While paying, "available" stops meaning "playable" and starts meaning
 * "spendable": the only question in front of the player is what to spend.
 * The card being paid *for* is the subject of the mode, not a candidate in
 * it. It has to look different from a card being spent: marking both the
 * same way said "these two cards are going away", when one of them is the
 * thing you are buying.
 */
function paintHandSlot(ctx: BoardDrawContext, slot: Rect, card: HandCardView, payment: PaymentView | null, discard: DiscardChoiceView | null = null): HandCardState {
  if (discard) {
    const isSubject = discard.source === card.instanceId;
    const picked = discard.picked.has(card.instanceId);
    const available = isSubject || picked || discard.candidates.includes(card.instanceId);
    const alpha = available ? 1 : ink.illegal;
    const g = ctx.scene.add.graphics();
    paintPanel(g, slot, "card", isSubject || picked ? "selected" : available ? "rest" : "unavailable");
    if (isSubject) {
      // The card whose cost this is gets the same static ring a payment's subject does.
      const ring = new McSelectionRing(ctx.scene);
      ring.show(slot, "static", true);
      ctx.frame.rings.push(ring);
    }
    return { spent: picked, subject: isSubject, alpha };
  }
  const spent = payment?.spent.has(card.instanceId) ?? false;
  const subject = payment?.subject === card.instanceId;
  const available = payment
    ? subject || spent || payment.spendable.has(card.instanceId)
    : (ctx.marks?.playable.has(card.instanceId) ?? false);
  const alpha = available ? 1 : ink.illegal;

  const g = ctx.scene.add.graphics();
  paintPanel(g, slot, "card", subject ? "selected" : available ? "rest" : "unavailable");
  if (subject) {
    // The design's treatment for the card being paid for: the red ring.
    const ring = new McSelectionRing(ctx.scene);
    ring.show(slot, "static", true);
    ctx.frame.rings.push(ring);
  }
  return { spent, subject, alpha };
}

/**
 * A collapsed hand card (`cardRow`'s "spine" slot): a position number and
 * the card's name running vertically, standing in for a card that has no
 * room to show its face this draw. Still a full tap target — tap, hold and
 * right-click all mean exactly what they mean on a full card — and still
 * drags to scroll like every other card in this row.
 */
function drawHandSpine(ctx: BoardDrawContext, slot: Rect, card: HandCardView, handIndex: number, payment: PaymentView | null, discard: DiscardChoiceView | null = null): void {
  const { scene } = ctx;
  const { spent, alpha } = paintHandSlot(ctx, slot, card, payment, discard);

  label(scene, slot.x + 3, slot.y + 4, String(handIndex + 1), typeRole.label, surface.ink.hex, ink.label * alpha);

  const name = scene.add
    .text(slot.x + slot.width / 2, slot.y + slot.height - 6, card.name, textStyle(typeRole.label, surface.ink.hex, alpha))
    .setOrigin(0.5, 1)
    .setAngle(-90);
  // Pre-rotation width becomes the strip's readable height once turned on
  // its side, so that — not `slot.width` — is what `fitText` has to fit.
  fitText(name, slot.height - 22, typeRole.label.size);

  if (spent) {
    const wash = scene.add.graphics();
    wash.fillStyle(surface.ink.hex, 0.3).fillRect(slot.x, slot.y, slot.width, slot.height);
  }

  ctx.makeTapTarget(slot, card.instanceId, () => ctx.controller.tapHandCard(card.instanceId), (deltaX) => ctx.hand.scrollBy(-deltaX));
}

/**
 * One card in hand, in the Long Table canvas's layout: a header strip of cost
 * chip + name + type line, an art band, the rules text, then the resource
 * pips the card generates when spent. An illegal card keeps its place at 38%
 * ink and carries the engine's own reason as a badge ("dim, don't hide").
 */
function drawHandCard(ctx: BoardDrawContext, slot: Rect, card: HandCardView, payment: PaymentView | null, discard: DiscardChoiceView | null = null): void {
  const { scene } = ctx;
  const { spent, subject, alpha } = paintHandSlot(ctx, slot, card, payment, discard);

  // A hand slot keeps the physical card's 2.5:3.5, and a scan is that same
  // shape, so the scan *is* the card face: it fills the slot with nothing
  // cropped and nothing letterboxed, and it already prints the name, cost,
  // type and rules text better than we can redraw them at this size.
  const inner: Rect = { x: slot.x + 3, y: slot.y + 3, width: slot.width - 6, height: slot.height - 6 };
  const key = ctx.art.request(scene, card.art);
  const drawn = drawArt(scene, key, inner, { fit: "cover", alpha });
  if (!drawn) drawHandCardFallback(scene, inner, card, alpha);

  // Chrome the scan cannot carry, because it is about this game rather than
  // this card: what the engine will not let you do with it right now, and
  // which side of a payment this card is on.
  const tag = payment
    ? subject
      ? { text: "paying for", ground: accent.heroRed.hex }
      : spent
        ? { text: "spent", ground: surface.ink.hex }
        : null
    : discard
      ? subject
        ? { text: "discarding for", ground: accent.heroRed.hex }
        : spent
          ? { text: "discarding", ground: surface.ink.hex }
          : null
      : (() => {
          const reason = ctx.marks?.unplayable.get(card.instanceId);
          return reason ? { text: shortReason(reason), ground: surface.ink.hex } : null;
        })();
  if (tag && slot.width >= 70) {
    // Inside the card during payment or a discard choice: that mode's own bar
    // sits directly above the hand, and a tag hung over the top edge disappears behind it.
    scene.add
      .text(slot.x + slot.width - 3, payment || discard ? slot.y + 4 : slot.y - 9, caseOf(typeRole.label, tag.text), textStyle(typeRole.label, surface.paper.hex))
      .setOrigin(1, 0)
      .setLetterSpacing(typeRole.label.letterSpacing)
      .setPadding(4, 2, 4, 2)
      .setBackgroundColor(cssOf(tag.ground));
  }
  drawPriceChip(scene, inner, card, alpha);

  if (spent) {
    // A spent card is on its way to the discard pile. Enough of a wash to
    // read as "gone", not so much that the hand looks broken.
    const wash = scene.add.graphics();
    wash.fillStyle(surface.ink.hex, 0.3).fillRect(slot.x + 3, slot.y + 3, slot.width - 6, slot.height - 6);
  }

  ctx.makeTapTarget(slot, card.instanceId, () => ctx.controller.tapHandCard(card.instanceId), (deltaX) => ctx.hand.scrollBy(-deltaX));
}

/**
 * "3→2" over the card's own cost pip, when the table is charging something other than the printed price.
 *
 * The pip in the top-left corner is the first thing a player reads off a card, and while Steve Rogers is in
 * alter-ego it is simply wrong — Living Legend takes 1 off the first ally played each round, so a Mockingbird
 * that prints 3 costs 2 and the payment bar counts to 2 with no explanation anywhere on the table. The chip
 * sits exactly where the wrong number is, covering it: the printed cost stays visible on the left of the arrow
 * so the change is legible as a change rather than as a different card.
 *
 * Green means cheaper and red means dearer, but neither is load-bearing — both numbers and the arrow are text
 * (PLAN.md Phase 4 accessibility, "never colour alone"). `costSources` names the card responsible; the chip has
 * no room for it, so Inspect and the payment bar carry the name.
 */
function drawPriceChip(scene: Phaser.Scene, inner: Rect, card: HandCardView, alpha: number): void {
  const { cost, currentCost } = card;
  if (cost === null || currentCost === null || currentCost === cost) return;

  const chip: Rect = { x: inner.x, y: inner.y, width: Math.min(40, inner.width - 4), height: 18 };
  const ground = currentCost < cost ? signal.heal.hex : accent.heroRed.hex;
  const g = scene.add.graphics();
  g.fillStyle(ground, alpha).fillRect(chip.x, chip.y, chip.width, chip.height);
  const text = scene.add
    .text(chip.x + chip.width / 2, chip.y + chip.height / 2, `${cost}→${currentCost}`, textStyle(typeRole.statSmall, surface.paper.hex, alpha))
    .setOrigin(0.5);
  fitText(text, chip.width - 4, typeRole.statSmall.size);
}

/**
 * The generated card face, for a card with no scan. Header strip of cost chip
 * plus name and type line, then the rules text, then the resource pips —
 * the Long Table canvas's layout, and the designed behaviour for a missing
 * scan rather than an error state.
 */
function drawHandCardFallback(scene: Phaser.Scene, slot: Rect, card: HandCardView, alpha: number): void {
  const headerHeight = Math.min(30, Math.max(22, Math.round(slot.height * 0.2)));
  const header: Rect = { x: slot.x, y: slot.y, width: slot.width, height: headerHeight };
  let nameLeft = header.x + 4;
  if (card.cost !== null) {
    const chip: Rect = { x: header.x, y: header.y, width: 20, height: header.height };
    const chipG = scene.add.graphics();
    chipG.fillStyle(signal.cost.hex, alpha).fillRect(chip.x, chip.y, chip.width, chip.height);
    scene.add
      .text(chip.x + chip.width / 2, chip.y + chip.height / 2, String(card.cost), textStyle(typeRole.statSmall, surface.paper.hex, alpha))
      .setOrigin(0.5);
    nameLeft = chip.x + chip.width + 4;
  }
  scene.add
    .text(nameLeft, header.y + 1, card.name, textStyle(typeRole.rowTitle, surface.ink.hex, alpha))
    .setWordWrapWidth(header.x + header.width - nameLeft)
    .setMaxLines(1);
  label(scene, nameLeft, header.y + 15, card.typeLine, typeRole.label, surface.ink.hex, ink.label * alpha);
  const headerRule = scene.add.graphics();
  headerRule.fillStyle(surface.ink.hex, alpha).fillRect(header.x, header.y + header.height, header.width, 2);

  const pipRow = card.resourceIcons.length > 0 ? 16 : 0;
  const textTop = header.y + header.height + 5;
  scene.add
    .text(slot.x + 2, textTop, card.rulesText, textStyle(typeRole.body, surface.ink.hex, ink.secondary * alpha))
    .setWordWrapWidth(slot.width - 4)
    .setMaxLines(Math.max(1, Math.floor((slot.y + slot.height - pipRow - 4 - textTop) / 15)));

  // One colour for every resource, with the type carried by a glyph rather
  // than a hue: the palette has one "resource" signal, and an indicator must
  // never rely on colour alone (PLAN.md Phase 4, accessibility).
  card.resourceIcons.forEach((icon, iconIndex) => {
    const box: Rect = { x: slot.x + 3 + iconIndex * 15, y: slot.y + slot.height - 15, width: 12, height: 12 };
    if (box.x + box.width > slot.x + slot.width - 2) return;
    const pip = scene.add.graphics();
    pip.fillStyle(signal.cost.hex, alpha).fillRect(box.x, box.y, box.width, box.height);
    scene.add
      .text(box.x + box.width / 2, box.y + box.height / 2, RESOURCE_GLYPH[icon], textStyle(typeRole.label, surface.paper.hex, alpha))
      .setOrigin(0.5);
  });
}

/**
 * The type of a resource, as a glyph. Colour says "resource"; the glyph says
 * which one, so the distinction survives colourblindness and a 12px pip.
 */
const RESOURCE_GLYPH: Readonly<Record<ResourceIconType, string>> = {
  physical: "P",
  mental: "M",
  energy: "E",
  wild: "*",
};

/**
 * The engine's reason as a tag that fits on a card corner. The full sentence
 * stays available — this only picks the short form of a code the engine gave.
 */
function shortReason(reason: IllegalReason): string {
  switch (reason.code) {
    case "wrong_form":
      return "wrong form";
    case "insufficient_resources":
      return "can't afford";
    case "already_exhausted":
      return "exhausted";
    case "limit_reached":
      return "limit";
    case "no_valid_target":
      return "no target";
    case "card_type_not_playable":
      return "not an action";
    case "already_changed_form":
      return "already flipped";
    default:
      return "illegal";
  }
}
