/**
 * Civil War scenario builder geometry (docs/phase7-wave10-client.md sections 2.2, 2.8 and 6.2). A pure function from
 * the viewport and the item counts of each section to rectangles. No Phaser, no state.
 *
 * Three arrangements, chosen by `formFactorFor`:
 *
 * - **phone** (`phone`, `phoneLandscape`): one step per screen. Header (Back, title), the active step's scroll region,
 *   a bottom step bar (five segments), and a sticky foot with Random / Random and blind above the full-width Start
 *   (one row of three when the viewport is wide enough, as in phone landscape).
 * - **tablet** (`tabletPortrait`, `tabletLandscape`): the step rail down the left, the active step beside it, the same
 *   sticky foot (one row) across the bottom.
 * - **desktop**: as tablet, plus a persistent review column on the right so every change is visible as it is made.
 *
 * Start is in the foot at every size and never scrolls. Everything that can be longer than its region (the active
 * step's content) is laid out in *content space*: rectangles are unscrolled positions that begin at `content.y` and
 * are clipped to `content` (a declared scroll region); `contentHeight` says how tall the stack is and `scrollable`
 * whether it exceeds the region. Fixed rectangles (header, rail, step bar, review column, foot) never scroll.
 *
 * `insets` are device safe areas (notch, home indicator); the header and foot grow by them and the side gutters grow
 * by the left/right insets.
 */
import { hit } from "../tokens.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";

export const HEADER_HEIGHT = 64;
export const BUILDER_STEP_COUNT = 5;
export const STEP_RAIL_WIDTH_TABLET = 200;
export const STEP_RAIL_WIDTH_DESKTOP = 220;
/** One entry in the left step rail (title plus the step's current pick as one line). */
export const STEP_RAIL_ITEM_HEIGHT = 64;
export const REVIEW_COLUMN_WIDTH = 300;
export const SECTION_LABEL_HEIGHT = 26;
export const SECTION_GAP = 16;
export const ROW_GAP = 8;
/** The Side card: both leaders' pictures with their names. */
export const SIDE_CARD_HEIGHT = 204;
/** A Leader card: the leader's picture and facts, then its two stage cards as faces. */
export function leaderCardHeight(width: number): number {
  return 168 + stageFaceSize(width).height + 22 + 18 + 10;
}
/** A Leader card's stage faces: two portrait cards (leaders are printed portrait) side by side, capped so a wide card does not grow tall. */
function stageFaceSize(width: number): { width: number; height: number } {
  const w = Math.min(124, Math.floor((width - 32) / 2));
  return { width: w, height: Math.round((w * 7) / 5) };
}
/** A main scheme stage choice: its card face (landscape), name, target threat, a short gist and a "Read card" strip. */
export function stageCardHeight(width: number): number {
  return 8 + Math.round(((width - 16) * 5) / 7) + 6 + 30 + 16 + 30 + 4 + READ_STRIP_HEIGHT;
}
export const READ_STRIP_HEIGHT = 32;
/** A modular set tile: a fan of its cards, its name, and a strip with its card count that opens the set's sheet. */
export const MODULAR_TILE_HEIGHT = 148;
/** A modular set tile's height at the global Card size factor (`settings.ts`'s `cardSizeFactor`: 1, 1.25 or 1.5). */
export const modularTileHeight = (cardScale = 1): number => Math.round(MODULAR_TILE_HEIGHT * safeScale(cardScale));
/** A zero, negative or non-finite factor means Standard. */
function safeScale(cardScale: number): number {
  return Number.isFinite(cardScale) && cardScale > 0 ? cardScale : 1;
}
export const MODULAR_FAN_SIZE = 64;
export const MODULAR_TILE_MIN_WIDTH = 150;
export const MODULAR_MAX_COLUMNS = 5;
/** The summary's reserve for its text list under the pictures. */
const SUMMARY_TEXT_RESERVE = 190;
const SUMMARY_PIC = { width: 78, height: 110 } as const;
const SUMMARY_SET_THUMB = 76;
/** The summary (leader picture, two stage faces, the chosen sets' thumbnails, the facts) for a column `width` wide. */
export function summaryHeight(width: number): number {
  const face = Math.round(((width - 32) / 2) * (5 / 7));
  return 10 + SUMMARY_PIC.height + 10 + face + 22 + 8 + SUMMARY_SET_THUMB + 8 + SUMMARY_TEXT_RESERVE;
}
/** The read-only body of the review step on phone and tablet: the summary, then room for the Preconstructed button. */
export const reviewBodyHeight = (width: number): number => summaryHeight(width) + 52;
/** A difficulty card: its name and a two-line description. */
export const DIFFICULTY_HEIGHT = 76;
/** The "Preconstructed" reset button. */
export const PRECONSTRUCTED_HEIGHT = 44;
const FOOT_PAD = 8;
const TWO_ROW_FOOT_BELOW_WIDTH = 520;

export type BuilderStep = 1 | 2 | 3 | 4 | 5;
export type BuilderMode = "phone" | "tablet" | "desktop";

export interface BuilderInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface BuilderLayoutInput {
  readonly width: number;
  readonly height: number;
  /** The active step; defaults to 1. */
  readonly step?: BuilderStep;
  /** Tiles per modular section: the side's own sets, other products' sets, and the other side's sets. */
  readonly setCounts?: { readonly side: number; readonly other: number; readonly otherSide: number };
  /** The "other side's sets" section expanded (its tiles disabled but visible). Default false: one line. */
  readonly otherSideExpanded?: boolean;
  /** Tiles in the "Extra sets (not counted)" row under the grid. Default 0 (row absent). */
  readonly extraSets?: number;
  readonly insets?: Partial<BuilderInsets>;
  /** The global Card size factor (1, 1.25 or 1.5); default 1. Larger: fewer, taller tiles, fewer stage cards per line. */
  readonly cardScale?: number;
}

export interface StageRowLayout {
  readonly label: Rect;
  /** Four cards: one row where the region is wide (640 and up), else 2 by 2. */
  readonly cards: readonly Rect[];
}

export interface ModularSectionLayout {
  readonly key: "side" | "other" | "otherSide" | "extra";
  readonly label: Rect;
  readonly tiles: readonly Rect[];
}

export interface BuilderLayout {
  readonly formFactor: FormFactor;
  readonly mode: BuilderMode;
  readonly step: BuilderStep;
  readonly headerBar: Rect;
  readonly back: Rect;
  readonly title: Rect;
  /** Tablet / desktop: the left step rail. Null on phone. */
  readonly rail: Rect | null;
  /** Phone: the bottom step bar. Null on tablet / desktop. */
  readonly stepBar: Rect | null;
  /** Five touch targets, one per step: rail items, or step bar segments. */
  readonly stepButtons: readonly Rect[];
  /** The active step's scroll region. */
  readonly content: Rect;
  /** Height of the active step's stacked content; the region scrolls when it exceeds `content.height`. */
  readonly contentHeight: number;
  readonly scrollable: boolean;
  /** Desktop only: the persistent review column. Null elsewhere. */
  readonly review: Rect | null;
  readonly foot: Rect;
  readonly random: Rect;
  readonly randomBlind: Rect;
  readonly start: Rect;

  /** Steps 1 and 2: two large cards (side by side, or stacked when the region is narrow). */
  readonly choiceCards: readonly Rect[];
  /** Step 3: two rows of four stage cards, and the summary sentence under them. */
  readonly stageRows: readonly StageRowLayout[];
  readonly stageSummary: Rect;
  /** Step 4: the counter line, the sections' labels and tiles, and the column count. */
  readonly modularCounter: Rect;
  readonly modularColumns: number;
  readonly modularSections: readonly ModularSectionLayout[];
  /** Step 5: the review body and the option rows (all content space). */
  readonly reviewBody: Rect;
  /**
   * True where step 5 repeats the summary (phone and tablet, which have no review column); false on desktop, whose
   * right-hand column is the always-visible summary, so `reviewBody` there is only the Preconstructed button's row.
   */
  readonly summaryInStep: boolean;
  /** The "Preconstructed" reset button (content space). */
  readonly preconstructed: Rect;
  readonly difficulty: readonly [Rect, Rect];
  /** Cooperative (enabled) and "Competitive - coming soon" (disabled; still a full touch target). */
  readonly gameMode: readonly [Rect, Rect];
  /** Random's three controls: keep the side, keep the leader, draw 3 or 4 sets (content space, under the game mode). */
  readonly randomPins: readonly [Rect, Rect, Rect];
}

/** Tiles in a grid of `columns`: the height of `count` tiles laid out row by row. Grows with the count. */
export function builderGridHeight(count: number, columns: number, cardScale = 1): number {
  if (count <= 0) return 0;
  const rows = Math.ceil(count / columns);
  return rows * modularTileHeight(cardScale) + (rows - 1) * ROW_GAP;
}

/** How many tiles wide the modular grid is in a region `width` wide. Phone is always two. */
export function builderGridColumns(width: number, mode: BuilderMode, cardScale = 1): number {
  if (mode === "phone") return 2;
  const fit = Math.floor((width + ROW_GAP) / (MODULAR_TILE_MIN_WIDTH * safeScale(cardScale) + ROW_GAP));
  return Math.max(2, Math.min(MODULAR_MAX_COLUMNS, fit));
}

/** Every fixed (non-scrolling) rectangle, for a no-overlap test. The foot's buttons sit inside `foot` by design. */
export function builderLayoutRects(layout: BuilderLayout): readonly Rect[] {
  return [
    layout.back,
    layout.title,
    ...(layout.rail ? [layout.rail] : []),
    ...(layout.stepBar ? [layout.stepBar] : []),
    layout.content,
    ...(layout.review ? [layout.review] : []),
    layout.foot,
  ];
}

const grid = (x: number, y: number, width: number, columns: number, count: number, tileHeight: number): Rect[] => {
  const tileW = (width - (columns - 1) * ROW_GAP) / columns;
  return Array.from({ length: count }, (_, i) => ({
    x: x + (i % columns) * (tileW + ROW_GAP),
    y: y + Math.floor(i / columns) * (tileHeight + ROW_GAP),
    width: tileW,
    height: tileHeight,
  }));
};

export function civilWarBuilderLayout(input: BuilderLayoutInput): BuilderLayout {
  const { width, height } = input;
  const step: BuilderStep = input.step ?? 1;
  const formFactor = formFactorFor(width, height);
  const mode: BuilderMode =
    formFactor === "phone" || formFactor === "phoneLandscape"
      ? "phone"
      : formFactor === "desktop"
        ? "desktop"
        : "tablet";
  const inset = { top: 0, right: 0, bottom: 0, left: 0, ...input.insets };
  const gutter = mode === "phone" ? 16 : 24;
  const gl = gutter + inset.left;
  const gr = gutter + inset.right;

  const headerHeight = HEADER_HEIGHT + inset.top;
  const headerBar: Rect = { x: 0, y: 0, width, height: headerHeight };
  const controlY = inset.top + (HEADER_HEIGHT - hit.target) / 2;
  const back: Rect = { x: 16 + inset.left, y: controlY, width: 90, height: hit.target };
  const title: Rect = {
    x: back.x + back.width + 8,
    y: controlY,
    width: Math.max(0, width - 16 - inset.right - (back.x + back.width + 8)),
    height: hit.target,
  };

  // Sticky foot: Random, Random and blind, Start. Two rows on a narrow phone, one row elsewhere.
  const twoRows = width < TWO_ROW_FOOT_BELOW_WIDTH;
  const footContent = twoRows ? hit.target + ROW_GAP + hit.primary : hit.primary;
  const footHeight = FOOT_PAD * 2 + footContent + inset.bottom;
  const foot: Rect = { x: 0, y: height - footHeight, width, height: footHeight };
  const footInner: Rect = { x: gl, y: foot.y + FOOT_PAD, width: width - gl - gr, height: footContent };
  let random: Rect;
  let randomBlind: Rect;
  let start: Rect;
  if (twoRows) {
    const half = (footInner.width - ROW_GAP) / 2;
    random = { x: footInner.x, y: footInner.y, width: half, height: hit.target };
    randomBlind = { x: footInner.x + half + ROW_GAP, y: footInner.y, width: half, height: hit.target };
    start = { x: footInner.x, y: footInner.y + hit.target + ROW_GAP, width: footInner.width, height: hit.primary };
  } else {
    const startW = Math.min(240, footInner.width * 0.4);
    const small = Math.min(200, (footInner.width - startW - ROW_GAP * 2) / 2);
    random = { x: footInner.x, y: footInner.y, width: small, height: hit.primary };
    randomBlind = { x: random.x + small + ROW_GAP, y: footInner.y, width: small, height: hit.primary };
    start = { x: footInner.x + footInner.width - startW, y: footInner.y, width: startW, height: hit.primary };
  }

  let rail: Rect | null = null;
  let stepBar: Rect | null = null;
  let review: Rect | null = null;
  let stepButtons: Rect[];
  let content: Rect;
  if (mode === "phone") {
    stepBar = { x: 0, y: foot.y - hit.target, width, height: hit.target };
    const seg = width / BUILDER_STEP_COUNT;
    stepButtons = Array.from({ length: BUILDER_STEP_COUNT }, (_, i) => ({
      x: i * seg,
      y: stepBar!.y,
      width: seg,
      height: hit.target,
    }));
    const top = headerHeight + ROW_GAP;
    content = { x: gl, y: top, width: width - gl - gr, height: Math.max(0, stepBar.y - ROW_GAP - top) };
  } else {
    const railWidth = mode === "desktop" ? STEP_RAIL_WIDTH_DESKTOP : STEP_RAIL_WIDTH_TABLET;
    const top = headerHeight + gutter;
    const bodyHeight = foot.y - gutter - top;
    rail = { x: gl, y: top, width: railWidth, height: bodyHeight };
    stepButtons = Array.from({ length: BUILDER_STEP_COUNT }, (_, i) => ({
      x: rail!.x,
      y: rail!.y + i * (STEP_RAIL_ITEM_HEIGHT + ROW_GAP),
      width: railWidth,
      height: STEP_RAIL_ITEM_HEIGHT,
    }));
    let right = width - gr;
    if (mode === "desktop") {
      review = { x: right - REVIEW_COLUMN_WIDTH, y: top, width: REVIEW_COLUMN_WIDTH, height: bodyHeight };
      right = review.x - gutter;
    }
    const left = rail.x + rail.width + gutter;
    content = { x: left, y: top, width: right - left, height: bodyHeight };
  }

  // Content space, from content.y. Rectangles below are unscrolled positions inside `content`'s width.
  const cx = content.x;
  const cw = content.width;
  const stacked = cw < 480;
  const choiceWidth = stacked ? cw : (cw - ROW_GAP) / 2;
  const choiceH = step === 2 ? leaderCardHeight(choiceWidth) : SIDE_CARD_HEIGHT;
  const choiceCards: Rect[] = stacked
    ? [0, 1].map((i) => ({ x: cx, y: content.y + i * (choiceH + ROW_GAP), width: cw, height: choiceH }))
    : [0, 1].map((i) => ({
        x: cx + i * (choiceWidth + ROW_GAP),
        y: content.y,
        width: choiceWidth,
        height: choiceH,
      }));
  const choiceHeight = stacked ? choiceH * 2 + ROW_GAP : choiceH;

  // Step 3: two rows of four stage cards (one row on tablet / desktop, 2 by 2 on phone).
  // A bigger card size asks for more room per card: four in a line from 640 wide at Standard, two from 240, else one.
  const scale = safeScale(input.cardScale ?? 1);
  const perLine = cw >= 640 * scale ? 4 : cw >= 240 * scale ? 2 : 1;
  const cardW = (cw - (perLine - 1) * ROW_GAP) / perLine;
  const stageH = stageCardHeight(cardW);
  let sy = content.y;
  const stageRows: StageRowLayout[] = [0, 1].map(() => {
    const label: Rect = { x: cx, y: sy, width: cw, height: SECTION_LABEL_HEIGHT };
    const cardsTop = sy + SECTION_LABEL_HEIGHT;
    const cards = Array.from({ length: 4 }, (_, i) => ({
      x: cx + (i % perLine) * (cardW + ROW_GAP),
      y: cardsTop + Math.floor(i / perLine) * (stageH + ROW_GAP),
      width: cardW,
      height: stageH,
    }));
    const lines = 4 / perLine;
    sy = cardsTop + lines * stageH + (lines - 1) * ROW_GAP + SECTION_GAP;
    return { label, cards };
  });
  const stageSummary: Rect = { x: cx, y: sy, width: cw, height: SECTION_LABEL_HEIGHT };
  const stagesHeight = stageSummary.y + stageSummary.height - content.y;

  // Step 4: counter line, then the sections.
  const columns = builderGridColumns(cw, mode, scale);
  const tileHeight = modularTileHeight(scale);
  const counts = input.setCounts ?? { side: 8, other: 0, otherSide: 8 };
  const modularCounter: Rect = { x: cx, y: content.y, width: cw, height: SECTION_LABEL_HEIGHT };
  let my = modularCounter.y + modularCounter.height + ROW_GAP;
  const modularSections: ModularSectionLayout[] = [];
  const addSection = (key: ModularSectionLayout["key"], count: number, oneLine = false): void => {
    if (count <= 0) return;
    const label: Rect = { x: cx, y: my, width: cw, height: oneLine ? hit.target : SECTION_LABEL_HEIGHT };
    my += label.height;
    if (oneLine) {
      modularSections.push({ key, label, tiles: [] });
      my += SECTION_GAP;
      return;
    }
    my += ROW_GAP;
    const tiles = grid(cx, my, cw, columns, count, tileHeight);
    my += builderGridHeight(count, columns, scale) + SECTION_GAP;
    modularSections.push({ key, label, tiles });
  };
  addSection("side", counts.side);
  addSection("other", counts.other);
  // Collapsed: one touch-target line, no tiles. Expanded: the tiles are laid out (the scene draws them disabled).
  addSection("otherSide", counts.otherSide, !input.otherSideExpanded);
  addSection("extra", input.extraSets ?? 0);
  const modularHeight = Math.max(0, my - SECTION_GAP - content.y);

  // Step 5: review body, then difficulty (Standard / Expert) and game mode (Cooperative / Competitive soon).
  const summaryInStep = mode !== "desktop";
  const reviewBody: Rect = {
    x: cx,
    y: content.y,
    width: cw,
    height: summaryInStep ? reviewBodyHeight(cw) : PRECONSTRUCTED_HEIGHT,
  };
  const preconstructed: Rect = summaryInStep
    ? {
        x: reviewBody.x + 12,
        y: reviewBody.y + reviewBody.height - 52,
        width: Math.min(220, reviewBody.width - 24),
        height: PRECONSTRUCTED_HEIGHT,
      }
    : { x: cx, y: reviewBody.y, width: Math.min(220, cw), height: PRECONSTRUCTED_HEIGHT };
  const optionTop = reviewBody.y + reviewBody.height + SECTION_GAP;
  const half = (cw - ROW_GAP) / 2;
  const pair = (y: number, h: number): readonly [Rect, Rect] => [
    { x: cx, y, width: half, height: h },
    { x: cx + half + ROW_GAP, y, width: half, height: h },
  ];
  const difficulty = pair(optionTop, DIFFICULTY_HEIGHT);
  const gameMode = pair(optionTop + DIFFICULTY_HEIGHT + ROW_GAP, hit.target);
  const third = (cw - ROW_GAP * 2) / 3;
  const pinY = gameMode[0].y + hit.target + ROW_GAP;
  const pinRect = (i: number): Rect => ({ x: cx + i * (third + ROW_GAP), y: pinY, width: third, height: hit.target });
  const randomPins: readonly [Rect, Rect, Rect] = [pinRect(0), pinRect(1), pinRect(2)];
  const reviewStepHeight = pinY + hit.target - content.y;

  const contentHeight =
    step === 1 || step === 2 ? choiceHeight : step === 3 ? stagesHeight : step === 4 ? modularHeight : reviewStepHeight;

  return {
    formFactor,
    mode,
    step,
    headerBar,
    back,
    title,
    rail,
    stepBar,
    stepButtons,
    content,
    contentHeight,
    scrollable: contentHeight > content.height,
    review,
    foot,
    random,
    randomBlind,
    start,
    choiceCards,
    stageRows,
    stageSummary,
    modularCounter,
    modularColumns: columns,
    modularSections,
    reviewBody,
    summaryInStep,
    preconstructed,
    difficulty,
    gameMode,
    randomPins,
  };
}

// ---- the insides of each card (all pure, all inside the rect they are given) ----

/** The Side card: shape and name on top, then one picture per leader, each with its name under it. */
export interface SideCardParts {
  readonly shape: Rect;
  readonly name: Rect;
  readonly pictures: readonly [Rect, Rect];
  readonly captions: readonly [Rect, Rect];
}

export function sideCardParts(rect: Rect): SideCardParts {
  const pad = 12;
  const gap = 12;
  const pictureW = (rect.width - pad * 2 - gap) / 2;
  const top = rect.y + 52;
  const picture = (i: number): Rect => ({
    x: rect.x + pad + i * (pictureW + gap),
    y: top,
    width: pictureW,
    height: 112,
  });
  const caption = (i: number): Rect => ({ x: picture(i).x, y: top + 112 + 6, width: pictureW, height: 18 });
  return {
    shape: { x: rect.x + 16, y: rect.y + 14, width: 22, height: 24 },
    name: { x: rect.x + 50, y: rect.y + 14, width: rect.width - 50 - 40, height: 26 },
    pictures: [picture(0), picture(1)],
    captions: [caption(0), caption(1)],
  };
}

/** The Leader card: picture left, name and facts right, the two stage faces under them, the "Always in" line last. */
export interface LeaderCardParts {
  readonly picture: Rect;
  readonly name: Rect;
  readonly word: Rect;
  readonly stageLines: Rect;
  readonly expertNote: Rect;
  /** Two stage faces; each tap zone is the face and its caption together. */
  readonly faces: readonly [Rect, Rect];
  readonly captions: readonly [Rect, Rect];
  readonly alwaysIn: Rect;
}

export function leaderCardParts(rect: Rect): LeaderCardParts {
  const pad = 12;
  const picture: Rect = { x: rect.x + pad, y: rect.y + pad, width: 104, height: 146 };
  const textX = picture.x + picture.width + 12;
  const textW = rect.x + rect.width - pad - textX - 28;
  const size = stageFaceSize(rect.width);
  const facesY = rect.y + 168;
  const face = (i: number): Rect => ({
    x: rect.x + pad + i * (size.width + 8),
    y: facesY,
    width: size.width,
    height: size.height,
  });
  const caption = (i: number): Rect => ({ x: face(i).x, y: facesY + size.height + 2, width: size.width, height: 18 });
  return {
    picture,
    name: { x: textX, y: rect.y + 12, width: textW, height: 26 },
    word: { x: textX, y: rect.y + 40, width: textW + 28, height: 14 },
    stageLines: { x: textX, y: rect.y + 62, width: textW + 28, height: 34 },
    expertNote: { x: textX, y: rect.y + 100, width: textW + 28, height: 30 },
    faces: [face(0), face(1)],
    captions: [caption(0), caption(1)],
    alwaysIn: { x: rect.x + pad, y: facesY + size.height + 24, width: rect.width - pad * 2, height: 18 },
  };
}

/** A main scheme stage choice: the face, then name, threat, gist, and the "Read card" strip along the bottom. */
export interface StageOptionParts {
  readonly face: Rect;
  readonly name: Rect;
  readonly threat: Rect;
  readonly gist: Rect;
  readonly read: Rect;
}

export function stageOptionParts(rect: Rect): StageOptionParts {
  const faceW = rect.width - 16;
  const face: Rect = { x: rect.x + 8, y: rect.y + 8, width: faceW, height: Math.round((faceW * 5) / 7) };
  const nameY = face.y + face.height + 6;
  return {
    face,
    name: { x: rect.x + 8, y: nameY, width: rect.width - 16, height: 30 },
    threat: { x: rect.x + 8, y: nameY + 30, width: rect.width - 16, height: 14 },
    gist: { x: rect.x + 8, y: nameY + 46, width: rect.width - 16, height: 30 },
    read: { x: rect.x, y: rect.y + rect.height - READ_STRIP_HEIGHT, width: rect.width, height: READ_STRIP_HEIGHT },
  };
}

/** A modular set tile: "Recommended" line, the fan of faces, the name, and the strip (count, type, arrow) that opens the sheet. */
export interface SetTileParts {
  readonly recommended: Rect;
  readonly fan: Rect;
  readonly name: Rect;
  readonly strip: Rect;
}

export function setTileParts(rect: Rect): SetTileParts {
  // The fan takes whatever height the tile has beyond its fixed lines (64 in the Standard 148 tall tile).
  const fan = Math.max(MODULAR_FAN_SIZE, rect.height - (MODULAR_TILE_HEIGHT - MODULAR_FAN_SIZE));
  return {
    recommended: { x: rect.x + 8, y: rect.y + 4, width: rect.width - 40, height: 12 },
    fan: { x: rect.x + 8, y: rect.y + 18, width: rect.width - 16, height: fan },
    name: { x: rect.x + 8, y: rect.y + 18 + fan + 4, width: rect.width - 40, height: 30 },
    strip: { x: rect.x, y: rect.y + rect.height - 30, width: rect.width, height: 30 },
  };
}

/** The summary: leader picture with the first facts beside it, the two stage faces, the chosen sets thumbnails, then the rest of the facts. */
export interface SummaryParts {
  readonly picture: Rect;
  readonly beside: Rect;
  readonly stageFaces: readonly [Rect, Rect];
  readonly stageCaptions: readonly [Rect, Rect];
  readonly setThumbs: (count: number) => readonly Rect[];
  readonly setCaption: Rect;
  readonly facts: Rect;
}

export function summaryParts(rect: Rect): SummaryParts {
  const pad = 12;
  const picture: Rect = { x: rect.x + pad, y: rect.y + 10, width: SUMMARY_PIC.width, height: SUMMARY_PIC.height };
  const stageW = (rect.width - pad * 2 - 8) / 2;
  const stageH = Math.round((stageW * 5) / 7);
  const stageY = picture.y + picture.height + 10;
  const stageFace = (i: number): Rect => ({
    x: rect.x + pad + i * (stageW + 8),
    y: stageY,
    width: stageW,
    height: stageH,
  });
  const stageCaption = (i: number): Rect => ({ ...stageFace(i), y: stageY + stageH + 2, height: 16 });
  const setsY = stageY + stageH + 22 + 8;
  return {
    picture,
    beside: {
      x: picture.x + picture.width + 10,
      y: picture.y,
      width: rect.x + rect.width - pad - (picture.x + picture.width + 10),
      height: picture.height,
    },
    stageFaces: [stageFace(0), stageFace(1)],
    stageCaptions: [stageCaption(0), stageCaption(1)],
    setThumbs: (count) => {
      const columns = Math.max(4, count);
      const w = (rect.width - pad * 2 - (columns - 1) * 6) / columns;
      return Array.from({ length: count }, (_, i) => ({
        x: rect.x + pad + i * (w + 6),
        y: setsY,
        width: w,
        height: SUMMARY_SET_THUMB,
      }));
    },
    setCaption: { x: rect.x + pad, y: setsY, width: rect.width - pad * 2, height: SUMMARY_SET_THUMB },
    facts: {
      x: rect.x + pad,
      y: setsY + SUMMARY_SET_THUMB + 8,
      width: rect.width - pad * 2,
      height: SUMMARY_TEXT_RESERVE,
    },
  };
}

/** The "cards in this set" sheet: a panel over a dimmed screen, a header with Close, a scrolling grid, a footer with the pick button. */
export interface SetSheetLayout {
  readonly panel: Rect;
  readonly header: Rect;
  readonly close: Rect;
  readonly body: Rect;
  readonly footer: Rect;
  readonly action: Rect;
  readonly columns: number;
  /** Card cells in content space (from `body.y`, unscrolled). The image box is the cell minus its caption. */
  readonly cells: readonly Rect[];
  readonly imageHeight: number;
  readonly contentHeight: number;
}

/** Under each card: its name (up to two lines) and its type line. */
const SHEET_CAPTION = 46;

export function setSheetLayout(
  viewport: { width: number; height: number },
  count: number,
  cardScale = 1,
): SetSheetLayout {
  const scale = safeScale(cardScale);
  const margin = viewport.width < 520 ? 8 : 24;
  const width = Math.min(viewport.width - margin * 2, 760);
  const maxHeight = Math.min(viewport.height - margin * 2, 640);
  const headerHeight = 60;
  const footerHeight = 68;
  const bodyWidth = width - 24;
  const gap = 10;
  // Standard keeps at least two columns; a larger card size may go to one so a card is never squeezed below its minimum.
  const columns = Math.max(scale > 1 ? 1 : 2, Math.min(5, Math.floor((bodyWidth + gap) / (104 * scale + gap))));
  const cellW = (bodyWidth - (columns - 1) * gap) / columns;
  const imageHeight = Math.round(cellW * 1.4);
  const cellH = imageHeight + SHEET_CAPTION;
  const rows = Math.ceil(count / columns);
  const contentHeight = rows === 0 ? 0 : rows * cellH + (rows - 1) * gap;
  // The panel is as tall as its cards need (a set of five does not get a screenful of empty parchment), up to the screen.
  const height = Math.min(maxHeight, headerHeight + contentHeight + 4 + footerHeight + 8);
  const panel: Rect = {
    x: Math.round((viewport.width - width) / 2),
    y: Math.round((viewport.height - height) / 2),
    width,
    height,
  };
  const header: Rect = { x: panel.x, y: panel.y, width, height: headerHeight };
  const close: Rect = { x: panel.x + width - 12 - 96, y: panel.y + 8, width: 96, height: hit.target };
  const footer: Rect = { x: panel.x, y: panel.y + height - footerHeight, width, height: footerHeight };
  const action: Rect = { x: panel.x + 12, y: footer.y + 8, width: width - 24, height: hit.primary };
  const body: Rect = {
    x: panel.x + 12,
    y: header.y + header.height,
    width: bodyWidth,
    height: footer.y - (header.y + header.height) - 4,
  };
  const cells = Array.from({ length: count }, (_, i) => ({
    x: body.x + (i % columns) * (cellW + gap),
    y: body.y + Math.floor(i / columns) * (cellH + gap),
    width: cellW,
    height: cellH,
  }));
  return { panel, header, close, body, footer, action, columns, cells, imageHeight, contentHeight };
}
