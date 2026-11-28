/**
 * The Roster's four seat cards and the Team-Up strip above them, as parts of the screen's `mc-sheet`: a filled seat is the
 * hero's picture over a footer (hero, a saved deck's name, aspects), an empty one a dashed "+ Seat #n"; a tap opens the
 * seat's deck picker, a hold or Y inspects the hero. The strip draws a bracket from each partner's card up to a line with a
 * pill on it, for the Team-Up pairs the seated heroes form.
 */
import { currentCardsById } from "../../../content/pool.js";
import { heroPictureOf } from "../../../dom/hero-picture.js";
import type { SheetBuilder } from "../../../dom/sheet-builder.js";
import { TEAM_UP_ART, teamUpArtFor } from "../../../art/team-up-art.js";
import { cardDisplayName } from "../../../view/hero-names.js";
import { accent, ink, surface, typeRole } from "../../../tokens.js";
import { bangers } from "../../../ui/campaign-chrome.js";
import { caseOf } from "../../../ui/theme.js";
import { t } from "../../../i18n/translate.js";
import { ROSTER_SEAT_COUNT } from "../../../view/campaign-roster-model.js";
import type { Rect } from "../../../view/layout.js";
import type { SeatedPair } from "../../../view/seat-recommendations.js";
import { PAIR_ROW_HEIGHT } from "../../../view/seats-layout.js";
import { SEAT_FOOTER_THREE_LINES, type RosterCtx } from "./context.js";

export function wideSeatRects(x: number, y: number, width: number, height: number): Rect[] {
  const gap = 16;
  const cardWidth = (width - gap * (ROSTER_SEAT_COUNT - 1)) / ROSTER_SEAT_COUNT;
  return Array.from({ length: ROSTER_SEAT_COUNT }, (_, i) => ({
    x: x + i * (cardWidth + gap),
    y,
    width: cardWidth,
    height,
  }));
}

export function phoneSeatRects(x: number, y: number, width: number, height: number): Rect[] {
  const gap = 12;
  const cardWidth = (width - gap) / 2;
  const cardHeight = (height - gap) / 2;
  return Array.from({ length: ROSTER_SEAT_COUNT }, (_, i) => ({
    x: x + (i % 2) * (cardWidth + gap),
    y: y + Math.floor(i / 2) * (cardHeight + gap),
    width: cardWidth,
    height: cardHeight,
  }));
}

/**
 * The Team-Up marker above the seat cards: per pair, a bracket from each partner's card up to a line with a pill on it (the
 * pair's picture where there is one, "Team-Up: Colossus and Shadowcat"). On the phone's 2×2 grid only a top row card can
 * reach the strip, so the pill also says which seats ("#1 + #3") and the paired cards carry their own small tag
 * (`drawSeat`). Not interactive.
 */
export function drawPairStrip(
  ctx: RosterCtx,
  b: SheetBuilder,
  strip: Rect,
  pairs: readonly SeatedPair[],
  seatRects: readonly Rect[],
  cardsTop: number,
  phone: boolean,
): void {
  pairs.slice(0, Math.floor(strip.height / PAIR_ROW_HEIGHT)).forEach((pair, row) => {
    const y = strip.y + row * PAIR_ROW_HEIGHT + PAIR_ROW_HEIGHT / 2;
    const rects = pair.seats.map((seat) => seatRects[seat - 1]!);
    const xs = rects.map((rect) => rect.x + rect.width / 2);
    rects.forEach((rect, i) => {
      if (rect.y <= cardsTop + 1)
        b.poly(
          [
            [xs[i]!, y],
            [xs[i]!, cardsTop],
          ],
          { stroke: accent.heroRed.hex, strokeWidth: 2 },
        );
    });
    b.poly(
      [
        [xs[0]!, y],
        [xs[1]!, y],
      ],
      { stroke: accent.heroRed.hex, strokeWidth: 2 },
    );
    const art = teamUpArtFor(TEAM_UP_ART, pair.pair.names)?.badge ?? null;
    const held = art ? ctx.leases.image(art) : null;
    const ringSize = PAIR_ROW_HEIGHT - 2;
    const caption = (phone ? `${pair.label} · #${pair.seats[0]} + #${pair.seats[1]}` : pair.label).toLocaleUpperCase();
    const wanted = b.measure(caption, typeRole.label).width + 16 + (held?.src ? ringSize + 2 : 0);
    const width = Math.min(strip.width, wanted);
    const center = (xs[0]! + xs[1]!) / 2;
    const left = Math.max(strip.x, Math.min(strip.x + strip.width - width, center - width / 2));
    const pill: Rect = { x: left, y: y - ringSize / 2, width, height: ringSize };
    b.box(pill, { fill: surface.ink.hex });
    b.box(pill, { stroke: accent.heroRed.hex, strokeWidth: 2 });
    let textX = left + 8;
    if (held?.src) {
      b.image(
        { x: left + 1, y: pill.y + 1, width: ringSize - 2, height: ringSize - 2 },
        {
          src: held.src,
          cover: { x: 0.5, y: 0.5 },
          key: `pair-art:${pair.pair.key}`,
          ...(held.retry ? { retry: held.retry } : {}),
        },
      );
      textX = left + ringSize + 6;
    }
    b.text(textX, y, caption, typeRole.label, {
      color: surface.paper.hex,
      origin: [0, 0.5],
      fitWidth: left + width - textX - 6,
    });
  });
}

export function drawSeat(ctx: RosterCtx, b: SheetBuilder, seatNumber: number, rect: Rect): void {
  const { state } = ctx;
  const deck = state.seats[seatNumber - 1] ?? null;
  const key = `seat-${seatNumber}`;
  const open = (): void => ctx.openPicker(seatNumber);
  ctx.actions.set(key, open);
  if (!deck) {
    b.box(rect, { stroke: surface.ink.hex, strokeWidth: 2, dashed: true });
    b.text(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
      t("roster.addSeat", { number: seatNumber }).toLocaleUpperCase(),
      { ...typeRole.rowTitle, size: 12 },
      { color: surface.ink.hex, alpha: ink.meta, origin: [0.5, 0.5], italic: true },
    );
    b.tap(key, rect);
    ctx.stops.set(key, { rect, activate: open });
    return;
  }

  const seatView = state.model?.seats[seatNumber - 1] ?? null;
  // A saved deck's name takes a line of its own between the hero and the aspects (#658).
  const deckName = seatView?.deckName ?? null;
  // Never shorter than its lines (hero, deck name, aspects), so a short phone card (Team-Up rows above it) gives up art
  // rather than stacks its lines on each other; a card too short for even that keeps a little art.
  const footerHeight = Math.min(
    rect.height * 0.7,
    deckName
      ? Math.max(SEAT_FOOTER_THREE_LINES, Math.min(80, rect.height * 0.3))
      : Math.max(48, Math.min(64, rect.height * 0.22)),
  );
  const artRect: Rect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height - footerHeight };
  const identity = currentCardsById().get(deck.identityCardId as string);
  const picture = heroPictureOf(identity, ctx.leases);
  if (picture.src !== null)
    b.image(artRect, {
      src: picture.src,
      cover: { x: picture.cover.x, y: picture.cover.y, ...(picture.cover.centered ? { centered: true } : {}) },
      fill: surface.parchment.hex,
      key: `seat-art:${seatNumber}`,
      ...(picture.retry !== undefined ? { retry: picture.retry } : {}),
    });
  else b.box(artRect, { fill: surface.parchment.hex });

  const tag = `#${seatNumber}`;
  const tagBox = b.measure(tag, bangers(14, 1));
  b.box(
    { x: rect.x + 8, y: rect.y + 8, width: tagBox.width + 14, height: tagBox.height + 8 },
    { fill: surface.ink.hex },
  );
  b.text(rect.x + 15, rect.y + 12, tag, bangers(14, 1), { color: surface.paper.hex });

  // A paired hero on the phone's grid wears its own tag, since the strip above can't reach a bottom-row card.
  if (state.phoneLayout && state.pairs.some((pair) => pair.seats.includes(seatNumber))) {
    const word = caseOf(typeRole.label, t("roster.teamUp").toLocaleUpperCase());
    const size = b.measure(word, typeRole.label);
    b.box(
      { x: rect.x + rect.width - 8 - size.width - 10, y: rect.y + 8, width: size.width + 10, height: size.height + 6 },
      { fill: accent.heroRed.hex },
    );
    b.text(rect.x + rect.width - 8 - 5, rect.y + 11, word, typeRole.label, {
      color: surface.paper.hex,
      origin: [1, 0],
    });
  }

  const footer: Rect = { x: rect.x, y: rect.y + artRect.height, width: rect.width, height: footerHeight };
  b.box(footer, { fill: surface.card.hex });
  b.text(
    footer.x + 8,
    footer.y + 6,
    (identity ? cardDisplayName(identity) : (deck.identityCardId as string)).toLocaleUpperCase(),
    bangers(15, 0.9),
    {
      color: surface.ink.hex,
      fitWidth: footer.width - 16,
    },
  );
  if (deckName)
    b.text(footer.x + 8, footer.y + 26, deckName, typeRole.emphasis, {
      size: 12,
      color: surface.ink.hex,
      wrapWidth: footer.width - 16,
      maxLines: 1,
    });
  // A card too short for all three lines keeps the deck name, which tells two decks of a hero apart, and drops the aspects
  // line rather than drawing it over the name (the aspects are in the picker and the deck itself).
  if (!deckName || footerHeight >= SEAT_FOOTER_THREE_LINES)
    b.text(
      footer.x + 8,
      footer.y + footerHeight - 18,
      caseOf(typeRole.label, seatView?.aspectsLabel ?? ""),
      typeRole.label,
      {
        size: 9,
        color: surface.ink.hex,
        alpha: ink.meta,
      },
    );
  if (seatView && !seatView.legal)
    b.text(footer.x + footer.width - 8, footer.y + 6, t("deckStatus.illegal").toLocaleUpperCase(), typeRole.label, {
      color: accent.heroRed.hex,
      origin: [1, 0],
    });
  b.box(rect, { stroke: surface.ink.hex, strokeWidth: 3 });

  b.tap(key, rect, { inspect: true });
  const inspect = (): void => ctx.inspectIdentity(deck.identityCardId as string);
  ctx.inspects.set(key, inspect);
  ctx.stops.set(key, { rect, activate: open, inspect });
}
