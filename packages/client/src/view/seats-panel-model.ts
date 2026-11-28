/**
 * Take your seats' panel parts as plain data (`scenes/seats.ts` hands them to `@mc/ui`): a hero tile's words and marks
 * as an `mc-picture-card` model, how a seat card is framed, and where a pair of Team-Up seats' bracket runs. Nothing
 * here draws and nothing decides what may be seated: the scene works every fact out (the roster's verdict on each deck)
 * and this only says how it reads. Words arrive already translated.
 */
import type { McPictureCardModel, PictureCardStamp } from "@mc/ui";
import type { Rect } from "./layout.js";

const hex6 = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** An aspect stamp's colors (numbers, from `view/aspect-stamp.ts`) as the CSS the card draws. */
export function cardStampOf(stamp: {
  readonly label: string;
  readonly fill: number;
  readonly ink: number;
}): PictureCardStamp {
  return { label: stamp.label, fill: hex6(stamp.fill), ink: hex6(stamp.ink) };
}

export interface HeroCardWords {
  /** The hero's name, or the deck's name where one deck stands alone. */
  readonly title: string;
  /** The caption under it: the source and identity, or a recommendation's reason. */
  readonly subtitle: string;
  /** A short caution that replaces the caption (a deck's warning, what unlocks a locked hero), or null. */
  readonly warning: string | null;
  readonly stamps: readonly { readonly label: string; readonly fill: number; readonly ink: number }[];
  /** "SEAT 2", "LOCKED", "NOT READY": top right of the picture. Null draws none. */
  readonly tag: string | null;
  /** "Team-Up with Phoenix": top left of the picture, on an outlined plate. Null draws none. */
  readonly plate: string | null;
  /** The tile is the active seat's pick: the heavy red frame. */
  readonly selected: boolean;
}

/** Height of a hero tile's caption band: the title at 22px, two caption lines and their gaps. */
export const HERO_CAPTION_HEIGHT = 22 + 8 + 16 + 8 + 13;

/**
 * A hero tile's card model. The picture itself is the card's `picture` (cropped around the hero's own focal point), so
 * the model carries none: its `src` stays empty and its `initial` is what shows while the picture loads or is missing.
 */
export function heroCardModelOf(words: HeroCardWords, initial: string): McPictureCardModel {
  return {
    src: null,
    focusY: 0.34,
    dim: false,
    chip: "",
    chipTone: "action",
    title: words.title,
    detail: words.warning ?? words.subtitle,
    // A warning is words in the caution tone, never a color alone: it replaces the caption it stands for.
    detailTone: words.warning ? "caution" : "meta",
    initial,
    captionHeight: HERO_CAPTION_HEIGHT,
    stamps: words.stamps.map(cardStampOf),
    ...(words.tag ? { tag: words.tag } : {}),
    ...(words.plate ? { plate: words.plate } : {}),
    selected: words.selected,
    detailLines: 2,
    titleDisplay: true,
    titleSize: 22,
  };
}

/** How a seat card is framed. */
export type SeatFrame = "activeFilled" | "filled" | "activeEmpty" | "empty" | "locked";

/**
 * The frame of a seat card (the owner's W2b second pass, `scenes/seats.ts`): a filled active seat is a solid red frame, a
 * filled one a thin ink frame, the active empty seat a red dashed one (it must read as active with nothing in it), a
 * reachable empty seat an ink dashed one, and an empty seat further out (not selectable: fill the one before it first) is
 * the same dashed frame, dimmed.
 */
export function seatFrameOf(
  slot: { readonly active: boolean; readonly filled: boolean },
  selectable: boolean,
): SeatFrame {
  if (slot.filled) return slot.active ? "activeFilled" : "filled";
  if (slot.active) return "activeEmpty";
  return selectable ? "empty" : "locked";
}

/** The seat label: "SEAT 1 · YOU", "SEAT 2 · PICKING", "SEAT 3". `you` says whether this is the first seat and filled. */
export function seatLabelOf(
  words: { readonly seat: string; readonly picking: string; readonly you: string },
  frame: SeatFrame,
  index: number,
  roomy = true,
): string {
  if (frame === "activeEmpty") return words.picking;
  return `${words.seat}${index === 0 && (frame === "activeFilled" || frame === "filled") && roomy ? words.you : ""}`;
}

/** One row of a Team-Up pair's bracket: the two seats' centers (x) and the row's own y. */
export interface PairBracket {
  readonly xs: readonly [number, number];
  readonly y: number;
}

/** Where each seated pair's bracket runs under the seat cards: a line down from each partner to one across, row by row. */
export function pairBracketsOf(
  strip: Rect,
  pairs: readonly { readonly seats: readonly [number, number] }[],
  seatRects: readonly Rect[],
  rowHeight: number,
): readonly PairBracket[] {
  return pairs.slice(0, Math.floor(strip.height / rowHeight)).map((pair, row) => ({
    xs: [
      seatRects[pair.seats[0] - 1]!.x + seatRects[pair.seats[0] - 1]!.width / 2,
      seatRects[pair.seats[1] - 1]!.x + seatRects[pair.seats[1] - 1]!.width / 2,
    ] as const,
    y: strip.y + row * rowHeight + rowHeight / 2,
  }));
}

/** The pill on a bracket: as wide as its words (and picture), kept inside the strip and centered between the partners. */
export function pairPillRect(
  strip: Rect,
  bracket: PairBracket,
  textWidth: number,
  ringSize: number,
  hasArt: boolean,
): Rect {
  const width = Math.min(strip.width, textWidth + 16 + (hasArt ? ringSize + 2 : 0));
  const center = (bracket.xs[0] + bracket.xs[1]) / 2;
  const left = Math.max(strip.x, Math.min(strip.x + strip.width - width, center - width / 2));
  return { x: left, y: bracket.y - ringSize / 2, width, height: ringSize };
}
