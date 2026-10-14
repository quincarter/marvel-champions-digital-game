/**
 * The docked villain phase's geometry on desktop (the "rail", D1/D2 in `artifacts/design-screenshots/villain-phase/`).
 *
 * The phase sits on the right, under the chrome band, in the rectangle the Board leaves for it
 * (`view/villain-dock.ts`). Top to bottom:
 *  - the header: "VILLAIN PHASE — ROUND N" with SKIP and HIDE ▸ beside it, and the subtitle under it;
 *  - the five steps, as a vertical list (D1), or as one row of chips while encounter cards are revealed (D2) or when
 *    the list would squeeze the body under its floor (a 900px-tall desktop with an interrupt open);
 *  - during the reveal step, "ENCOUNTER CARDS THIS ROUND · N OF M" and a strip of tiles, one per card dealt (#128);
 *  - the body: "HAPPENING NOW" with the enemy's thumbnail, or the revealed encounter card large enough to read;
 *  - the inline interrupt window, when the player has one to answer;
 *  - the phase log in whatever height is left;
 *  - the footer with the AUTO-ADVANCE toggle.
 *
 * When the panel is short the log goes first, then the interrupt window gives back to its floor, then the body
 * shrinks; the footer keeps its height, and the interrupt window never drops below the room its buttons need. Pure: no text measurement, like every other layout module.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

/** A card's printed ratio, width over height. */
const CARD_RATIO = 2.5 / 3.5;

export const RAIL_PAD = 20;
const HEADER_HEIGHT = 50;
const SUBTITLE_HEIGHT = 22;
const STEP_ROW_HEIGHT = 40;
const STEP_ROW_GAP = 8;
const CHIP_ROW_HEIGHT = 40;
const STRIP_LABEL_HEIGHT = 24;
const STRIP_HEIGHT = 56;
const SECTION_GAP = 14;
const FOOTER_HEIGHT = 76;
/** The interrupt window with one option: title, card and text, then the buttons. */
const INTERRUPT_HEIGHT_ONE = 300;
/** How far the interrupt window gives back on a short panel: room for a readable card and the two buttons. */
const INTERRUPT_HEIGHT_MIN = 240;
/** Each further option adds a compact row. */
const INTERRUPT_EXTRA_ROW = 56;
const INTERRUPT_MAX_ROWS = 3;
const BODY_MIN = 150;
/** The revealed card never grows past this; the rest goes to the log. */
const REVEAL_BODY_MAX = 330;
const HAPPENING_BODY_MAX = 210;
const LOG_MIN = 60;

export interface VillainRailInput {
  /** Where the Board left room for the phase (`VillainDockRects.panel`). */
  readonly panel: Rect;
  /** True while encounter cards are being revealed: chips instead of the step list, and the encounter strip. */
  readonly revealing: boolean;
  /** How many options the inline interrupt window offers; 0 when there is no window. */
  readonly interruptOptions: number;
  /**
   * The global Card size (`cardSizeFactor`: 1, 1.25, 1.5): the enemy, the revealed card and the interrupt card are
   * drawn that much larger where the panel has the room, the log giving way first. Defaults to 1.
   */
  readonly cardScale?: number;
}

/** A share of a width scaled by the card size, never past `cap`. */
const scaledShare = (share: number, scale: number, cap: number): number => Math.min(cap, share * scale);

export interface VillainRailInterruptLayout {
  readonly frame: Rect;
  readonly title: Rect;
  /** The first option's card, drawn large. */
  readonly card: Rect;
  /** Name, tags and rules text beside the card. */
  readonly text: Rect;
  /** One row per further option, under the first (empty with one option). */
  readonly extraRows: readonly Rect[];
  /** The yellow USE / PLAY button. */
  readonly use: Rect;
  /** LET IT RESOLVE ▸. */
  readonly resolve: Rect;
}

export interface VillainRailLayout {
  /** Which docked shape: the desktop rail (D1/D2), the tablet landscape band (T1) or the tabbed panel (P1/P2/T2). */
  readonly kind: "rail" | "band" | "tab";
  readonly panel: Rect;
  readonly title: Rect;
  readonly skip: Rect;
  readonly hide: Rect;
  readonly subtitle: Rect;
  /** Five rects: rows of the step list, or chips in one row while revealing. */
  readonly steps: readonly Rect[];
  readonly stepMode: "list" | "chips";
  /** "ENCOUNTER CARDS THIS ROUND" and the "N OF M" counter; null outside the reveal step. */
  readonly encounterLabel: Rect | null;
  /** The strip of encounter-card tiles; null outside the reveal step. */
  readonly encounterStrip: Rect | null;
  /** "Happening now" or the revealed card. */
  readonly body: Rect;
  /** The card art inside the body: the enemy's thumbnail, or the revealed card large. */
  readonly bodyArt: Rect;
  /** Headline and text beside the art. */
  readonly bodyText: Rect;
  readonly interrupt: VillainRailInterruptLayout | null;
  /** The phase log; zero height when there is no room for it. */
  readonly log: Rect;
  /** The footer band (top rule to the panel's foot). */
  readonly footer: Rect;
  /** "AUTO-ADVANCE" and its one-line explanation beside the toggle; null where only the toggle fits. */
  readonly footerText: Rect | null;
  /** The AUTO-ADVANCE OFF / ON toggle at the footer's right. */
  readonly toggle: Rect;
}

/** The interrupt window's inner geometry for `frame`, with `options` options (at least one). */
export function villainRailInterruptLayout(frame: Rect, options: number, cardScale = 1): VillainRailInterruptLayout {
  const pad = 18;
  const inner = { x: frame.x + pad, width: frame.width - pad * 2 };
  const title: Rect = { x: inner.x, y: frame.y + 14, width: inner.width, height: 18 };
  if (frame.height < INTERRUPT_HEIGHT_MIN) return shortInterruptLayout(frame, options, inner, title, pad, cardScale);
  const buttonHeight = hit.primary + 12;
  const buttonsY = frame.y + frame.height - pad - buttonHeight;
  const extras = Math.max(0, Math.min(INTERRUPT_MAX_ROWS, options - 1));
  const extraHeight = extras * INTERRUPT_EXTRA_ROW;
  const cardTop = title.y + title.height + 12;
  const cardBottom = buttonsY - 14 - extraHeight;
  const cardHeight = Math.max(0, cardBottom - cardTop);
  const cardWidth = Math.min(
    Math.round(cardHeight * CARD_RATIO),
    Math.round(inner.width * scaledShare(0.34, cardScale, 0.46)),
  );
  const card: Rect = { x: inner.x, y: cardTop, width: cardWidth, height: Math.round(cardWidth / CARD_RATIO) };
  const text: Rect = {
    x: card.x + card.width + 16,
    y: cardTop,
    width: Math.max(0, inner.x + inner.width - (card.x + card.width + 16)),
    height: cardHeight,
  };
  const extraRows = Array.from({ length: extras }, (_, i) => ({
    x: inner.x,
    y: cardBottom + 6 + i * INTERRUPT_EXTRA_ROW,
    width: inner.width,
    height: INTERRUPT_EXTRA_ROW - 8,
  }));
  const resolveWidth = Math.round(inner.width * 0.36);
  return {
    frame,
    title,
    card,
    text,
    extraRows,
    use: { x: inner.x, y: buttonsY, width: inner.width - resolveWidth - 12, height: buttonHeight },
    resolve: { x: inner.x + inner.width - resolveWidth, y: buttonsY, width: resolveWidth, height: buttonHeight },
  };
}

/**
 * A short window (the tablet band, T1): no height to stack the card over the buttons, so the card runs the window's
 * full height on the left, and the text, any further options and the two buttons stand beside it.
 */
function shortInterruptLayout(
  frame: Rect,
  options: number,
  inner: { readonly x: number; readonly width: number },
  title: Rect,
  pad: number,
  cardScale: number,
): VillainRailInterruptLayout {
  const cardTop = title.y + title.height + 10;
  const cardHeight = Math.max(0, frame.y + frame.height - pad - cardTop);
  const cardWidth = Math.min(
    Math.round(cardHeight * CARD_RATIO),
    Math.round(inner.width * scaledShare(0.3, cardScale, 0.4)),
  );
  const card: Rect = { x: inner.x, y: cardTop, width: cardWidth, height: Math.round(cardWidth / CARD_RATIO) };
  const right = { x: card.x + card.width + 14, width: Math.max(0, inner.x + inner.width - (card.x + card.width + 14)) };
  const buttonsY = frame.y + frame.height - pad - hit.primary;
  const extras = Math.max(0, Math.min(INTERRUPT_MAX_ROWS, options - 1));
  const extraRows = Array.from({ length: extras }, (_, i) => ({
    x: right.x,
    y: buttonsY - 8 - (extras - i) * hit.target,
    width: right.width,
    height: hit.target - 4,
  }));
  const textBottom = (extraRows[0]?.y ?? buttonsY) - 8;
  const resolveWidth = Math.round(right.width * 0.4);
  return {
    frame,
    title,
    card,
    text: { x: right.x, y: cardTop, width: right.width, height: Math.max(0, textBottom - cardTop) },
    extraRows,
    use: { x: right.x, y: buttonsY, width: right.width - resolveWidth - 10, height: hit.primary },
    resolve: { x: right.x + right.width - resolveWidth, y: buttonsY, width: resolveWidth, height: hit.primary },
  };
}

export function villainRailLayout(input: VillainRailInput): VillainRailLayout {
  const { panel, revealing } = input;
  const x = panel.x + RAIL_PAD;
  const width = Math.max(0, panel.width - RAIL_PAD * 2);
  const bottom = panel.y + panel.height;

  const buttonWidth = 92;
  const hide: Rect = { x: x + width - buttonWidth, y: panel.y + RAIL_PAD, width: buttonWidth, height: HEADER_HEIGHT };
  const skip: Rect = { x: hide.x - 10 - buttonWidth, y: hide.y, width: buttonWidth, height: HEADER_HEIGHT };
  const title: Rect = { x, y: hide.y, width: Math.max(0, skip.x - 12 - x), height: HEADER_HEIGHT };
  const subtitle: Rect = { x, y: title.y + title.height + 2, width, height: SUBTITLE_HEIGHT };
  const stepsTop = subtitle.y + subtitle.height + 12;

  const footer: Rect = { x: panel.x, y: bottom - FOOTER_HEIGHT, width: panel.width, height: FOOTER_HEIGHT };
  const toggle: Rect = {
    x: x + width - 150,
    y: footer.y + (FOOTER_HEIGHT - hit.primary) / 2,
    width: 150,
    height: hit.primary,
  };

  const extras = Math.max(0, Math.min(INTERRUPT_MAX_ROWS, input.interruptOptions - 1));
  const scale = input.cardScale ?? 1;
  const interruptPreferred =
    input.interruptOptions > 0 ? Math.round(INTERRUPT_HEIGHT_ONE * scale) + extras * INTERRUPT_EXTRA_ROW : 0;
  const interruptFloor = input.interruptOptions > 0 ? INTERRUPT_HEIGHT_MIN + extras * INTERRUPT_EXTRA_ROW : 0;
  const stripHeight = revealing ? STRIP_LABEL_HEIGHT + 6 + STRIP_HEIGHT + SECTION_GAP : 0;
  const listHeight = 5 * STEP_ROW_HEIGHT + 4 * STEP_ROW_GAP + SECTION_GAP;
  const chipsHeight = CHIP_ROW_HEIGHT + SECTION_GAP;
  /** What body + interrupt + log share once the steps and the strip are drawn. */
  const roomAfter = (stepsHeight: number): number => footer.y - SECTION_GAP - stepsTop - stepsHeight - stripHeight;
  const interruptGap = interruptPreferred > 0 ? SECTION_GAP : 0;
  // The vertical list (D1) only while it leaves the body its floor; otherwise (and always while revealing, D2) chips.
  const stepMode: "list" | "chips" =
    revealing || roomAfter(listHeight) - interruptFloor - interruptGap < BODY_MIN ? "chips" : "list";
  const room = roomAfter(stepMode === "list" ? listHeight : chipsHeight) - interruptGap;

  const steps: Rect[] = [];
  for (let i = 0; i < 5; i++) {
    if (stepMode === "chips") {
      const gap = 8;
      const chipWidth = (width - gap * 4) / 5;
      steps.push({ x: x + i * (chipWidth + gap), y: stepsTop, width: chipWidth, height: CHIP_ROW_HEIGHT });
    } else {
      steps.push({ x, y: stepsTop + i * (STEP_ROW_HEIGHT + STEP_ROW_GAP), width, height: STEP_ROW_HEIGHT });
    }
  }
  let cursor = stepsTop + (stepMode === "list" ? listHeight : chipsHeight);

  let encounterLabel: Rect | null = null;
  let encounterStrip: Rect | null = null;
  if (revealing) {
    encounterLabel = { x, y: cursor, width, height: STRIP_LABEL_HEIGHT };
    encounterStrip = { x, y: cursor + STRIP_LABEL_HEIGHT + 6, width, height: STRIP_HEIGHT };
    cursor = encounterStrip.y + encounterStrip.height + SECTION_GAP;
  }

  // The body takes its full height first while the log still gets its floor; short of that the log goes, then the
  // interrupt window gives back down to its floor, then the body shrinks.
  const bodyMax = Math.round((revealing ? REVEAL_BODY_MAX : HAPPENING_BODY_MAX) * scale);
  let interruptHeight = interruptPreferred;
  let bodyHeight: number;
  if (room - interruptHeight - bodyMax - SECTION_GAP >= LOG_MIN) bodyHeight = bodyMax;
  else {
    // The body takes what the interrupt window's floor leaves, up to its own full height; the window then takes the
    // rest, up to its preferred height. The two never add up to more than the room.
    bodyHeight = Math.min(bodyMax, Math.max(0, room - interruptFloor));
    interruptHeight =
      interruptPreferred > 0 ? Math.min(interruptPreferred, Math.max(interruptFloor, room - bodyHeight)) : 0;
  }
  const body: Rect = { x, y: cursor, width, height: Math.max(0, bodyHeight) };
  cursor = body.y + body.height + SECTION_GAP;

  const artHeight = revealing ? body.height : Math.min(body.height, Math.round(170 * scale));
  const artShare = revealing ? scaledShare(0.44, scale, 0.6) : scaledShare(0.28, scale, 0.4);
  const artWidth = Math.min(Math.round(artHeight * CARD_RATIO), Math.round(width * artShare));
  const bodyArt: Rect = { x, y: body.y, width: artWidth, height: Math.round(artWidth / CARD_RATIO) };
  const bodyText: Rect = {
    x: bodyArt.x + bodyArt.width + 18,
    y: body.y,
    width: Math.max(0, x + width - (bodyArt.x + bodyArt.width + 18)),
    height: body.height,
  };

  let interrupt: VillainRailInterruptLayout | null = null;
  if (interruptHeight > 0) {
    interrupt = villainRailInterruptLayout(
      { x, y: cursor, width, height: interruptHeight },
      input.interruptOptions,
      scale,
    );
    cursor += interruptHeight + SECTION_GAP;
  }

  const logHeight = Math.max(0, footer.y - SECTION_GAP - cursor);
  const log: Rect = { x, y: cursor, width, height: logHeight >= LOG_MIN ? logHeight : 0 };

  return {
    kind: "rail",
    panel,
    title,
    skip,
    hide,
    subtitle,
    steps,
    stepMode,
    encounterLabel,
    encounterStrip,
    body,
    bodyArt,
    bodyText,
    interrupt,
    log,
    footer,
    footerText: { x, y: footer.y + 14, width: Math.max(0, toggle.x - 12 - x), height: FOOTER_HEIGHT - 28 },
    toggle,
  };
}

const BAND_PAD = 16;
const BAND_HEADER = 44;

/**
 * Tablet landscape (T1): the phase takes the villain band, under the chrome and above the player's hero, play area and
 * hand, which stay in view. One header row (title, the five step chips, SKIP and HIDE ▸), then columns: the body (the
 * enemy or the revealed card), the interrupt window when one is open, and a narrow right column with the phase log
 * (the encounter cards of the round while revealing) over the AUTO-ADVANCE toggle.
 */
export function villainBandLayout(input: VillainRailInput): VillainRailLayout {
  const { panel, revealing } = input;
  const x = panel.x + BAND_PAD;
  const width = Math.max(0, panel.width - BAND_PAD * 2);
  const top = panel.y + 12;
  const bottom = panel.y + panel.height - 12;

  const buttonWidth = 84;
  const hide: Rect = { x: x + width - buttonWidth, y: top, width: buttonWidth, height: BAND_HEADER };
  const skip: Rect = { x: hide.x - 8 - buttonWidth, y: top, width: buttonWidth, height: BAND_HEADER };
  const title: Rect = { x, y: top, width: Math.round(width * 0.36), height: BAND_HEADER };
  const chipsLeft = title.x + title.width + 12;
  const chipsWidth = Math.max(0, skip.x - 16 - chipsLeft);
  const gap = 6;
  const chipWidth = (chipsWidth - gap * 4) / 5;
  const chipHeight = 36;
  const steps: Rect[] = Array.from({ length: 5 }, (_, i) => ({
    x: chipsLeft + i * (chipWidth + gap),
    y: top + (BAND_HEADER - chipHeight) / 2,
    width: chipWidth,
    height: chipHeight,
  }));

  const contentTop = top + BAND_HEADER + 12;
  const contentHeight = Math.max(0, bottom - contentTop);
  const rightWidth = Math.max(200, Math.round(width * 0.22));
  const rightX = x + width - rightWidth;
  const mainWidth = Math.max(0, rightX - 16 - x);
  const interruptWidth = input.interruptOptions > 0 ? Math.round(mainWidth * 0.55) : 0;
  const bodyWidth = interruptWidth > 0 ? mainWidth - interruptWidth - 16 : mainWidth;

  const body: Rect = { x, y: contentTop, width: bodyWidth, height: contentHeight };
  const artWidth = Math.min(
    Math.round(body.height * CARD_RATIO),
    Math.round(body.width * scaledShare(0.42, input.cardScale ?? 1, 0.56)),
  );
  const bodyArt: Rect = { x, y: body.y, width: artWidth, height: Math.round(artWidth / CARD_RATIO) };
  const bodyText: Rect = {
    x: bodyArt.x + bodyArt.width + 14,
    y: body.y,
    width: Math.max(0, x + bodyWidth - (bodyArt.x + bodyArt.width + 14)),
    height: body.height,
  };

  const interrupt =
    interruptWidth > 0
      ? villainRailInterruptLayout(
          { x: x + bodyWidth + 16, y: contentTop, width: interruptWidth, height: contentHeight },
          input.interruptOptions,
          input.cardScale ?? 1,
        )
      : null;

  // The right column holds the phase log, or while revealing the encounter cards of the round, stacked: the band has
  // no height to spare over the revealed card (#128).
  const toggle: Rect = { x: rightX, y: bottom - hit.target, width: rightWidth, height: hit.target };
  const columnHeight = Math.max(0, toggle.y - 12 - contentTop);
  let encounterLabel: Rect | null = null;
  let encounterStrip: Rect | null = null;
  if (revealing) {
    encounterLabel = { x: rightX, y: contentTop, width: rightWidth, height: STRIP_LABEL_HEIGHT };
    encounterStrip = {
      x: rightX,
      y: contentTop + STRIP_LABEL_HEIGHT + 4,
      width: rightWidth,
      height: Math.max(0, columnHeight - STRIP_LABEL_HEIGHT - 4),
    };
  }
  const log: Rect = {
    x: rightX,
    y: contentTop,
    width: rightWidth,
    height: !revealing && columnHeight >= LOG_MIN ? columnHeight : 0,
  };

  return {
    kind: "band",
    panel,
    title,
    skip,
    hide,
    subtitle: { x, y: top, width: 0, height: 0 },
    steps,
    stepMode: "chips",
    encounterLabel,
    encounterStrip,
    body,
    bodyArt,
    bodyText,
    interrupt,
    log,
    footer: toggle,
    footerText: null,
    toggle,
  };
}

const TAB_PAD = 12;

/**
 * Phone and tablet portrait (P1/P2, T2): the phase takes everything between the chrome and the hand, which stays in
 * view under it, and its own two buttons (USE / PLAY, and RESOLVE ▸) take the action bar's place at the thumb
 * (`footer`, the action bar's rectangle). Top to bottom: the header (title, PEEK AT TABLE ▾ in HIDE's place, SKIP),
 * the step chips, the encounter strip while revealing, the body, the interrupt window (its card and text; the buttons
 * are in the footer), then the phase log in what is left. There is no AUTO-ADVANCE toggle here (it is in Settings
 * and on the recap).
 */
export function villainTabLayout(input: VillainRailInput & { readonly footer: Rect }): VillainRailLayout {
  const { panel, revealing, footer } = input;
  const x = panel.x + TAB_PAD;
  const width = Math.max(0, panel.width - TAB_PAD * 2);
  const bottom = panel.y + panel.height - TAB_PAD;
  const narrow = width < 500;

  const headerHeight = hit.target;
  const skipWidth = narrow ? 64 : 92;
  const peekWidth = narrow ? 132 : 170;
  const skip: Rect = { x: x + width - skipWidth, y: panel.y + TAB_PAD, width: skipWidth, height: headerHeight };
  const hide: Rect = { x: skip.x - 8 - peekWidth, y: skip.y, width: peekWidth, height: headerHeight };
  const title: Rect = { x, y: skip.y, width: Math.max(0, hide.x - 10 - x), height: headerHeight };

  let cursor = title.y + title.height + 10;
  const chipGap = 6;
  const chipWidth = (width - chipGap * 4) / 5;
  const steps: Rect[] = Array.from({ length: 5 }, (_, i) => ({
    x: x + i * (chipWidth + chipGap),
    y: cursor,
    width: chipWidth,
    height: 36,
  }));
  cursor += 36 + 10;

  let encounterLabel: Rect | null = null;
  let encounterStrip: Rect | null = null;
  if (revealing) {
    encounterLabel = { x, y: cursor, width, height: STRIP_LABEL_HEIGHT };
    encounterStrip = { x, y: cursor + STRIP_LABEL_HEIGHT + 4, width, height: 52 };
    cursor = encounterStrip.y + encounterStrip.height + 10;
  }

  const extras = Math.max(0, Math.min(INTERRUPT_MAX_ROWS, input.interruptOptions - 1));
  const interruptHeight = input.interruptOptions > 0 ? (narrow ? 196 : 220) + extras * hit.target : 0;
  const room = Math.max(0, bottom - cursor - (interruptHeight > 0 ? interruptHeight + 10 : 0));
  const scale = input.cardScale ?? 1;
  const bodyMax = Math.round((revealing ? (narrow ? 250 : 380) : narrow ? 180 : 230) * scale);
  const bodyHeight = Math.min(bodyMax, room);
  const body: Rect = { x, y: cursor, width, height: bodyHeight };
  const artShare = revealing ? scaledShare(0.42, scale, 0.58) : scaledShare(0.3, scale, 0.42);
  const artWidth = Math.min(Math.round((body.height - 16) * CARD_RATIO), Math.round(width * artShare));
  const bodyArt: Rect = { x: x + 8, y: body.y + 8, width: artWidth, height: Math.round(artWidth / CARD_RATIO) };
  const bodyText: Rect = {
    x: bodyArt.x + bodyArt.width + 14,
    y: body.y + 8,
    width: Math.max(0, x + width - 8 - (bodyArt.x + bodyArt.width + 14)),
    height: Math.max(0, body.height - 16),
  };
  cursor = body.y + body.height + 10;

  let interrupt: VillainRailInterruptLayout | null = null;
  if (interruptHeight > 0) {
    const frame: Rect = { x, y: cursor, width, height: interruptHeight };
    const pad = 14;
    const titleRect: Rect = { x: x + pad, y: frame.y + 12, width: width - pad * 2, height: 18 };
    const cardTop = titleRect.y + titleRect.height + 10;
    const cardBottom = frame.y + frame.height - pad - extras * hit.target;
    const cardWidth = Math.min(
      Math.round((cardBottom - cardTop) * CARD_RATIO),
      Math.round(width * scaledShare(0.3, scale, 0.42)),
    );
    const card: Rect = { x: x + pad, y: cardTop, width: cardWidth, height: Math.round(cardWidth / CARD_RATIO) };
    const textX = card.x + card.width + 14;
    // The answer is the action bar's: USE / PLAY on the left, RESOLVE ▸ on the right, at the thumb.
    const resolveWidth = Math.round((footer.width - 24) * 0.38);
    interrupt = {
      frame,
      title: titleRect,
      card,
      text: { x: textX, y: cardTop, width: Math.max(0, x + width - pad - textX), height: cardBottom - cardTop },
      extraRows: Array.from({ length: extras }, (_, i) => ({
        x: x + pad,
        y: cardBottom + i * hit.target,
        width: width - pad * 2,
        height: hit.target - 4,
      })),
      use: {
        x: footer.x + 8,
        y: footer.y + 6,
        width: footer.width - 24 - resolveWidth,
        height: Math.max(hit.target, footer.height - 12),
      },
      resolve: {
        x: footer.x + footer.width - 8 - resolveWidth,
        y: footer.y + 6,
        width: resolveWidth,
        height: Math.max(hit.target, footer.height - 12),
      },
    };
    cursor += interruptHeight + 10;
  }

  const logHeight = Math.max(0, bottom - cursor);
  const log: Rect = { x, y: cursor, width, height: logHeight >= LOG_MIN ? logHeight : 0 };

  return {
    kind: "tab",
    panel,
    title,
    skip,
    hide,
    subtitle: { x, y: panel.y, width: 0, height: 0 },
    steps,
    stepMode: "chips",
    encounterLabel,
    encounterStrip,
    body,
    bodyArt,
    bodyText,
    interrupt,
    log,
    footer,
    footerText: null,
    toggle: { x: footer.x, y: footer.y, width: 0, height: 0 },
  };
}

/** The peek banner (P3): over the bottom of the board, just above the action bar, while the phase waits. */
export interface VillainPeekLayout {
  readonly banner: Rect;
  readonly thumb: Rect;
  readonly text: Rect;
  readonly back: Rect;
}

export function villainPeekLayout(footer: Rect): VillainPeekLayout {
  const height = 112;
  const banner: Rect = { x: footer.x + 8, y: footer.y - height - 8, width: footer.width - 16, height };
  const thumbHeight = height - 24;
  const thumb: Rect = {
    x: banner.x + 12,
    y: banner.y + 12,
    width: Math.round(thumbHeight * CARD_RATIO),
    height: thumbHeight,
  };
  const backWidth = Math.min(120, Math.round(banner.width * 0.26));
  const back: Rect = {
    x: banner.x + banner.width - 12 - backWidth,
    y: banner.y + (height - 64) / 2,
    width: backWidth,
    height: 64,
  };
  return {
    banner,
    thumb,
    text: {
      x: thumb.x + thumb.width + 12,
      y: banner.y + 12,
      width: Math.max(0, back.x - 12 - (thumb.x + thumb.width + 12)),
      height: height - 24,
    },
    back,
  };
}
