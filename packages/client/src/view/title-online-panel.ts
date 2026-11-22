/**
 * The Title's "Play online" feature panel (#880, owner feedback on PR #901): on a tablet or desktop the entry is a
 * comic splash panel rather than one more button in the menu grid, so the screen's spare room says what online play is
 * and offers its two ways in (Host a room, Join a room) at once.
 *
 * Two placements, both plain rectangles for the scene to draw:
 * - **side**: a wide screen (a 1440 desktop and up) gives the menu a wider panel and the splash stands to the right of
 *   the menu column, as tall as the menu, its two buttons stacked;
 * - **art**: any other tablet or desktop (a 1024x768 tablet, a portrait tablet, a laptop) lays it as a caption box over
 *   the bottom of the art panel, above the rank badge, its buttons side by side where the box is wide enough.
 *
 * A phone keeps the plain "Play online" button in the menu grid and gets no panel.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export type OnlinePanelPlacement = "side" | "art";

/** The side panel's width and its gap to the menu column. */
export const ONLINE_SIDE_WIDTH = 300;
export const ONLINE_SIDE_GAP = 28;
/** The widest a caption box over the art grows. */
export const ONLINE_ART_MAX_WIDTH = 440;
/** At or over this inner width the two buttons sit side by side instead of stacked. */
const ROW_BUTTONS_MIN_WIDTH = 330;
const PAD = 14;
const BAND_ART = 38;
const GAP = 8;
const LINE = 18;
const SIDE_BAND = 112;
const SIDE_BAND_SHORT = 84;
const LIVE_ART_WIDTH = 92;
const DIVIDER = 4;
const SEATS_MIN_HEIGHT = 48;

export interface OnlinePanelLayout {
  readonly placement: OnlinePanelPlacement;
  readonly rect: Rect;
  /** The halftone header band the title sits on. */
  readonly band: Rect;
  /** 2 when the title is "PLAY" over "ONLINE!", 1 when it is one line. */
  readonly titleLines: 1 | 2;
  readonly title: Rect;
  /** The "N live" chip: right end of the band (art) or under the pitch (side); null where it has no room. */
  readonly live: Rect | null;
  readonly pitch: Rect;
  /** Free room between the chip and the buttons (side placement, tall enough): the scene draws a table of seats in it. */
  readonly seats: Rect | null;
  /** How many lines the pitch is allowed. */
  readonly pitchLines: number;
  readonly host: Rect;
  readonly join: Rect;
}

const pitchLinesFor = (inner: number): number => (inner < 300 ? 3 : 2);

/** How much height a caption box over the art, `width` wide, wants. */
export function onlineArtHeight(width: number): number {
  const inner = width - PAD * 2;
  const buttons = inner >= ROW_BUTTONS_MIN_WIDTH ? hit.target : hit.target * 2 + GAP;
  return PAD + BAND_ART + GAP + pitchLinesFor(inner) * LINE + GAP + buttons + PAD;
}

/** The side panel's tallest, and the least it is drawn at (its pitch needs the room). */
export const ONLINE_SIDE_MAX_HEIGHT = 440;
export const ONLINE_SIDE_MIN_HEIGHT = SIDE_BAND_SHORT + GAP + 2 * LINE + GAP + hit.primary * 2 + GAP + PAD;

/**
 * Whether a split screen of `width` x `height` has the room for the side placement, decided from its size alone: the
 * art panel keeps at least a third of the width (and 400px) once the menu column, the gap and the panel are in.
 */
export function onlineSideFits(width: number, height: number, pad: number, column: number): boolean {
  if (height < 720) return false;
  return sideArtWidth(width, pad, column) >= Math.max(400, width * 0.32);
}

/** The art panel's width when the side panel is in: what is left of the screen, never more than the usual 45%. */
export function sideArtWidth(width: number, pad: number, column: number): number {
  const needed = column + ONLINE_SIDE_GAP + ONLINE_SIDE_WIDTH + pad * 2;
  return Math.min(Math.round(width * 0.45), width - needed - DIVIDER);
}

/** The inside of a panel placed at `rect`. */
export function onlinePanelIn(rect: Rect, placement: OnlinePanelPlacement): OnlinePanelLayout {
  const innerX = rect.x + PAD;
  const inner = rect.width - PAD * 2;
  if (placement === "side") {
    const tall = rect.height >= 400;
    const band: Rect = { x: rect.x, y: rect.y, width: rect.width, height: tall ? SIDE_BAND : SIDE_BAND_SHORT };
    const pitchLines = tall ? 3 : 2;
    const pitch: Rect = { x: innerX, y: band.y + band.height + GAP, width: inner, height: pitchLines * LINE };
    const live: Rect | null = tall ? { x: innerX, y: pitch.y + pitch.height + GAP, width: inner, height: 22 } : null;
    const join: Rect = { x: innerX, y: rect.y + rect.height - PAD - hit.primary, width: inner, height: hit.primary };
    const host: Rect = { x: innerX, y: join.y - GAP - hit.primary, width: inner, height: hit.primary };
    const seatsTop = (live ? live.y + live.height : pitch.y + pitch.height) + GAP;
    const seatsHeight = host.y - GAP - seatsTop;
    return {
      placement,
      rect,
      band,
      titleLines: tall ? 2 : 1,
      title: { x: innerX, y: band.y + PAD, width: inner, height: band.height - PAD * 2 },
      live,
      pitch,
      seats: seatsHeight >= SEATS_MIN_HEIGHT ? { x: innerX, y: seatsTop, width: inner, height: seatsHeight } : null,
      pitchLines,
      host,
      join,
    };
  }
  const band: Rect = { x: rect.x, y: rect.y, width: rect.width, height: PAD + BAND_ART - 6 };
  const pitchLines = pitchLinesFor(inner);
  const pitch: Rect = { x: innerX, y: band.y + band.height + GAP, width: inner, height: pitchLines * LINE };
  const row = inner >= ROW_BUTTONS_MIN_WIDTH;
  const buttonsY = pitch.y + pitch.height + GAP;
  const half = Math.floor((inner - 10) / 2);
  const host: Rect = { x: innerX, y: buttonsY, width: row ? half : inner, height: hit.target };
  const join: Rect = row
    ? { x: innerX + inner - half, y: buttonsY, width: half, height: hit.target }
    : { x: innerX, y: buttonsY + hit.target + GAP, width: inner, height: hit.target };
  return {
    placement,
    rect,
    band,
    titleLines: 1,
    title: { x: innerX, y: band.y + 4, width: inner - LIVE_ART_WIDTH - 8, height: band.height - 8 },
    live: { x: innerX + inner - LIVE_ART_WIDTH, y: band.y + (band.height - 22) / 2, width: LIVE_ART_WIDTH, height: 22 },
    pitch,
    seats: null,
    pitchLines,
    host,
    join,
  };
}

/** Every rectangle the panel draws, for overlap checks. */
export const onlinePanelRects = (panel: OnlinePanelLayout): readonly Rect[] => [
  panel.title,
  panel.pitch,
  ...(panel.seats ? [panel.seats] : []),
  ...(panel.live ? [panel.live] : []),
  panel.host,
  panel.join,
];

/** The "N live" count the panel words, or null to draw nothing (no answer yet, none live, offline). */
export const liveCountOf = (rooms: number | null): number | null => (rooms !== null && rooms > 0 ? rooms : null);

/** Moves a panel down by `dy` (the notice bar's inset). */
export function shiftOnlinePanel(panel: OnlinePanelLayout, dy: number): OnlinePanelLayout {
  const move = (r: Rect): Rect => ({ ...r, y: r.y + dy });
  return {
    ...panel,
    rect: move(panel.rect),
    band: move(panel.band),
    title: move(panel.title),
    live: panel.live ? move(panel.live) : null,
    pitch: move(panel.pitch),
    seats: panel.seats ? move(panel.seats) : null,
    host: move(panel.host),
    join: move(panel.join),
  };
}
