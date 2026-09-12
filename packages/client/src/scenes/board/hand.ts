/**
 * The player's hand: the row of cards, its scroll on the tabbed board, and each
 * card's face — full, collapsed to a spine, or the generated fallback.
 */

import type Phaser from "phaser";
import type { ResourceIconType } from "@mc/content";
import { drawArt } from "../../art/card-art.js";
import { accent, hit, ink, signal, surface, typeRole } from "../../tokens.js";
import { caseOf, cssOf, textStyle } from "../../ui/theme.js";
import { McSelectionRing, fitText, label, paintPanel } from "../../ui/widgets.js";
import type { BoardModel, HandCardView } from "../../view/board-model.js";
import type { IllegalReason } from "../../view/highlights.js";
import { cardRow, type Rect } from "../../view/layout.js";
import type { PaymentView } from "../../view/payment-model.js";
import type { BoardDrawContext } from "./context.js";
import { drawPaymentBar } from "./payment-bar.js";
import { focusKey } from "./selection.js";

/**
 * The tabbed hand's horizontal scroll and fan state.
 *
 * `cardRow`'s own output never shrinks or shifts for the scroll; the draw
 * subtracts `scrollX` from every slot's `x`, the same separation the phone tabs
 * keep between "what the layout computed" and "what the player is currently
 * looking at."
 */
export class HandScroll {
  readonly #redraw: () => void;
  /** In unscrolled-layout pixels — how far the row has been dragged or scrolled left. */
  #scrollX = 0;
  /** This draw's ceiling for `#scrollX`, re-measured by `drawHand` every draw. */
  #maxScroll = 0;
  /** The hand's own content rect, unscrolled — where a wheel gesture has to land to scroll it. */
  #contentRect: Rect | null = null;
  /** Whether the tabbed hand shows every card at full size (and scrolls further) instead of collapsing the overflow to spines. */
  #fannedOut = false;

  constructor(redraw: () => void) {
    this.#redraw = redraw;
  }

  get scrollX(): number {
    return this.#scrollX;
  }

  get fannedOut(): boolean {
    return this.#fannedOut;
  }

  get canScroll(): boolean {
    return this.#maxScroll > 0;
  }

  /** Records this draw's row, clamping the scroll to what now fits. */
  measure(content: Rect, rowRight: number): void {
    this.#maxScroll = Math.max(0, rowRight - (content.x + content.width));
    this.#scrollX = this.#maxScroll > 0 ? Math.min(this.#scrollX, this.#maxScroll) : 0;
    this.#contentRect = content;
  }

  /** Moves the scroll by a pixel delta (positive reveals more to the right), clamped to what the last draw measured. */
  scrollBy(delta: number): void {
    if (this.#maxScroll <= 0) return;
    const next = Math.min(this.#maxScroll, Math.max(0, this.#scrollX + delta));
    if (next === this.#scrollX) return;
    this.#scrollX = next;
    this.#redraw();
  }

  /**
   * A wheel or trackpad gesture over the hand's own rect scrolls it
   * horizontally. The tabbed board is the only layout that ever needs
   * scrolling, so this is a no-op everywhere else.
   */
  onWheel(pointer: Phaser.Input.Pointer, _objects: unknown, deltaX: number, deltaY: number): void {
    const rect = this.#contentRect;
    if (!rect || this.#maxScroll <= 0) return;
    if (pointer.y < rect.y || pointer.y > rect.y + rect.height) return;
    // A vertical mouse wheel is still "scroll the hand" here — there is
    // nothing in this rect to scroll vertically, and a trackpad's horizontal
    // deltaX takes priority when a gesture actually has one. Positive scrolls
    // right (reveals more of the hand), matching a page's own vertical wheel.
    this.scrollBy(deltaX !== 0 ? deltaX : deltaY);
  }

  toggleFan(): void {
    this.#fannedOut = !this.#fannedOut;
    // A fresh view onto whatever shape the row just took, rather than
    // leaving the player scrolled to a position that meant something
    // different a moment ago.
    this.#scrollX = 0;
    this.#redraw();
  }
}

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

  // While paying, the caption line gives way to the payment bar: the hand is
  // the instrument of the payment, so the count belongs directly over it.
  const payment = ctx.controller.paymentView();
  let top = rect.y + 20;
  if (payment) {
    drawPaymentBar(ctx, { x: rect.x, y: rect.y, width: rect.width, height: hit.target }, payment);
    top = rect.y + hit.target + 4;
  } else {
    label(
      scene,
      rect.x + 10,
      rect.y + 4,
      `hand ${model.hand.length} · deck ${model.myPiles.deck} · discard ${model.myPiles.discard}`,
      typeRole.label,
      surface.paper.hex,
      ink.label,
    );
  }

  const inner: Rect = { x: rect.x + 10, y: top, width: rect.width - 20, height: rect.y + rect.height - top - 8 };
  const fan: boolean | "expanded" = tabbed ? (hand.fannedOut ? "expanded" : true) : false;
  const slots = cardRow(inner, model.hand.length, { gap: 6, maxHeight: inner.height, fan });

  const rowRight = slots.reduce((max, slot) => Math.max(max, slot.x + slot.width), inner.x);
  hand.measure(inner, rowRight);

  // The pill only earns its place once there's something to fan or unfan —
  // a hand that already fits has nothing to expand and nowhere to scroll.
  if (tabbed && !payment && (hand.canScroll || hand.fannedOut)) {
    drawFanToggle(ctx, rect);
  }

  model.hand.forEach((card, index) => {
    const slot = slots[index];
    if (!slot) return;
    const drawn: Rect = { ...slot, x: slot.x - hand.scrollX };
    ctx.frame.hitRects.set(card.instanceId, drawn);
    ctx.frame.focusRects.set(focusKey({ kind: "card", instanceId: card.instanceId }), drawn);
    if (slot.kind === "spine") drawHandSpine(ctx, drawn, card, index, payment);
    else drawHandCard(ctx, drawn, card, payment);
  });
}

/**
 * The tabbed hand's "Fan out" pill (`Board - Phone`): toggles between the
 * default row (full-size cards for as many as fit, the rest collapsed to
 * spines) and every card shown full-size, both scrollable. An outlined chip
 * rather than a filled button, the design's own language for a toggle
 * rather than a committing action.
 */
function drawFanToggle(ctx: BoardDrawContext, handRect: Rect): void {
  const { scene, hand } = ctx;
  const width = 62;
  const chip: Rect = { x: handRect.x + handRect.width - width - 8, y: handRect.y + 3, width, height: 14 };
  const g = scene.add.graphics();
  g.lineStyle(2, surface.paper.hex, 1).strokeRect(chip.x, chip.y, chip.width, chip.height);
  scene.add
    .text(chip.x + chip.width / 2, chip.y + chip.height / 2, (hand.fannedOut ? "Collapse" : "Fan out").toUpperCase(), textStyle(typeRole.label, surface.paper.hex))
    .setOrigin(0.5)
    .setLetterSpacing(typeRole.label.letterSpacing);
  const zone = scene.add.zone(chip.x, chip.y, chip.width, chip.height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  zone.on("pointerup", () => hand.toggleFan());
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
function paintHandSlot(ctx: BoardDrawContext, slot: Rect, card: HandCardView, payment: PaymentView | null): HandCardState {
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
function drawHandSpine(ctx: BoardDrawContext, slot: Rect, card: HandCardView, handIndex: number, payment: PaymentView | null): void {
  const { scene } = ctx;
  const { spent, alpha } = paintHandSlot(ctx, slot, card, payment);

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
function drawHandCard(ctx: BoardDrawContext, slot: Rect, card: HandCardView, payment: PaymentView | null): void {
  const { scene } = ctx;
  const { spent, subject, alpha } = paintHandSlot(ctx, slot, card, payment);

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
    : (() => {
        const reason = ctx.marks?.unplayable.get(card.instanceId);
        return reason ? { text: shortReason(reason), ground: surface.ink.hex } : null;
      })();
  if (tag && slot.width >= 70) {
    // Inside the card during payment: the payment bar sits directly above the
    // hand, and a tag hung over the top edge disappears behind it.
    scene.add
      .text(slot.x + slot.width - 3, payment ? slot.y + 4 : slot.y - 9, caseOf(typeRole.label, tag.text), textStyle(typeRole.label, surface.paper.hex))
      .setOrigin(1, 0)
      .setLetterSpacing(typeRole.label.letterSpacing)
      .setPadding(4, 2, 4, 2)
      .setBackgroundColor(cssOf(tag.ground));
  }
  if (spent) {
    // A spent card is on its way to the discard pile. Enough of a wash to
    // read as "gone", not so much that the hand looks broken.
    const wash = scene.add.graphics();
    wash.fillStyle(surface.ink.hex, 0.3).fillRect(slot.x + 3, slot.y + 3, slot.width - 6, slot.height - 6);
  }

  ctx.makeTapTarget(slot, card.instanceId, () => ctx.controller.tapHandCard(card.instanceId), (deltaX) => ctx.hand.scrollBy(-deltaX));
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
