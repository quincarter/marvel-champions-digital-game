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
}

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
  /** The AUTO-ADVANCE OFF / ON toggle at the footer's right. */
  readonly toggle: Rect;
}

/** The interrupt window's inner geometry for `frame`, with `options` options (at least one). */
export function villainRailInterruptLayout(frame: Rect, options: number): VillainRailInterruptLayout {
  const pad = 18;
  const inner = { x: frame.x + pad, width: frame.width - pad * 2 };
  const title: Rect = { x: inner.x, y: frame.y + 14, width: inner.width, height: 18 };
  const buttonHeight = hit.primary + 12;
  const buttonsY = frame.y + frame.height - pad - buttonHeight;
  const extras = Math.max(0, Math.min(INTERRUPT_MAX_ROWS, options - 1));
  const extraHeight = extras * INTERRUPT_EXTRA_ROW;
  const cardTop = title.y + title.height + 12;
  const cardBottom = buttonsY - 14 - extraHeight;
  const cardHeight = Math.max(0, cardBottom - cardTop);
  const cardWidth = Math.min(Math.round(cardHeight * CARD_RATIO), Math.round(inner.width * 0.34));
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
  const interruptPreferred = input.interruptOptions > 0 ? INTERRUPT_HEIGHT_ONE + extras * INTERRUPT_EXTRA_ROW : 0;
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
  const bodyMax = revealing ? REVEAL_BODY_MAX : HAPPENING_BODY_MAX;
  let interruptHeight = interruptPreferred;
  let bodyHeight: number;
  if (room - interruptHeight - bodyMax - SECTION_GAP >= LOG_MIN) bodyHeight = bodyMax;
  else {
    bodyHeight = Math.min(bodyMax, Math.max(0, room - interruptHeight));
    if (bodyHeight < bodyMax && interruptHeight > interruptFloor) {
      const give = Math.min(interruptHeight - interruptFloor, bodyMax - bodyHeight);
      interruptHeight -= give;
      bodyHeight += give;
    }
  }
  const body: Rect = { x, y: cursor, width, height: Math.max(0, bodyHeight) };
  cursor = body.y + body.height + SECTION_GAP;

  const artHeight = revealing ? body.height : Math.min(body.height, 170);
  const artWidth = Math.min(Math.round(artHeight * CARD_RATIO), Math.round(width * (revealing ? 0.44 : 0.28)));
  const bodyArt: Rect = { x, y: body.y, width: artWidth, height: Math.round(artWidth / CARD_RATIO) };
  const bodyText: Rect = {
    x: bodyArt.x + bodyArt.width + 18,
    y: body.y,
    width: Math.max(0, x + width - (bodyArt.x + bodyArt.width + 18)),
    height: body.height,
  };

  let interrupt: VillainRailInterruptLayout | null = null;
  if (interruptHeight > 0) {
    interrupt = villainRailInterruptLayout({ x, y: cursor, width, height: interruptHeight }, input.interruptOptions);
    cursor += interruptHeight + SECTION_GAP;
  }

  const logHeight = Math.max(0, footer.y - SECTION_GAP - cursor);
  const log: Rect = { x, y: cursor, width, height: logHeight >= LOG_MIN ? logHeight : 0 };

  return {
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
    toggle,
  };
}
