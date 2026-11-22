/**
 * Where the Civil War Competitive result's two team columns go on the game-over screen (issue #883), as pure geometry.
 * Each column is the leader's picture with the team's side and result written over it, then a row of card scans (the
 * leader, then the team's heroes). The winner's column is the wider one, so it is the one the eye lands on; a tie or a
 * lost game for both gives the two columns equal width. The scene draws what this places and decides nothing.
 */
import type { Rect } from "./layout.js";

export interface TeamColumnLayout {
  readonly frame: Rect;
  /** The leader's picture. */
  readonly banner: Rect;
  /** The strip over the banner's bottom edge that carries the side, the result and the tags. */
  readonly label: Rect;
  /** One slot per card: the leader first, then each hero. */
  readonly cards: readonly Rect[];
}

export interface CompetitiveWideLayout {
  readonly columns: readonly [TeamColumnLayout, TeamColumnLayout];
  /** The tie-break / how-it-ended panel under the columns. */
  readonly panel: Rect;
}

export interface CompetitiveWideInput {
  readonly main: Rect;
  /** The winning team's index (0 registration, 1 resistance), or null for a tie / nobody. */
  readonly winner: 0 | 1 | null;
  /** How many card scans each column holds (the leader plus its heroes). */
  readonly cardCounts: readonly [number, number];
  /** Lines the panel will hold, for its height. */
  readonly panelLines: number;
}

const GAP = 14;
const PAD = 12;
const CARD_GAP = 8;
const LABEL_HEIGHT = 58;
const PANEL_HEAD = 72;
const PANEL_LINE = 24;

const slots = (inner: Rect, count: number): Rect[] => {
  const n = Math.max(1, count);
  const width = (inner.width - CARD_GAP * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({
    x: inner.x + i * (width + CARD_GAP),
    y: inner.y,
    width,
    height: inner.height,
  }));
};

function column(frame: Rect, count: number): TeamColumnLayout {
  const cardsHeight = Math.round(Math.min(210, Math.max(64, frame.height * 0.38)));
  const bannerHeight = Math.max(LABEL_HEIGHT + 20, frame.height - cardsHeight - PAD * 2);
  const banner: Rect = { x: frame.x, y: frame.y, width: frame.width, height: bannerHeight };
  return {
    frame,
    banner,
    label: { x: frame.x, y: frame.y + bannerHeight - LABEL_HEIGHT, width: frame.width, height: LABEL_HEIGHT },
    cards: slots(
      {
        x: frame.x + PAD,
        y: frame.y + bannerHeight + PAD,
        width: frame.width - PAD * 2,
        height: frame.y + frame.height - PAD - (frame.y + bannerHeight + PAD),
      },
      count,
    ),
  };
}

/** Desktop and tablet landscape: two columns over a panel, filling `main`. */
export function competitiveWideLayout(input: CompetitiveWideInput): CompetitiveWideLayout {
  const { main, winner, cardCounts, panelLines } = input;
  const panelHeight = Math.min(
    Math.round(main.height * 0.4),
    Math.max(90, PANEL_HEAD + Math.max(1, panelLines) * PANEL_LINE),
  );
  const height = Math.max(120, main.height - panelHeight - GAP);
  const room = main.width - GAP;
  const share = winner === null ? 0.5 : 0.56;
  const first = Math.round(room * (winner === 1 ? 1 - share : winner === 0 ? share : 0.5));
  const frames: [Rect, Rect] = [
    { x: main.x, y: main.y, width: first, height },
    { x: main.x + first + GAP, y: main.y, width: room - first, height },
  ];
  return {
    columns: [column(frames[0], cardCounts[0]), column(frames[1], cardCounts[1])],
    panel: { x: main.x, y: main.y + height + GAP, width: main.width, height: panelHeight },
  };
}

export interface CompetitiveTallInput {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly cardCounts: readonly [number, number];
  /** The room the columns may fill, top of `y` to the buttons; a taller screen gets bigger pictures and scans. Absent: the least. */
  readonly room?: number;
}

export interface CompetitiveTallLayout {
  readonly columns: readonly [TeamColumnLayout, TeamColumnLayout];
  /** The bottom of the columns, for what is stacked under them. */
  readonly bottom: number;
}

const TALL_BANNER = 72;
const TALL_CARDS = 44;
const TALL_LABEL = 34;
const TALL_MAX = 440;

/** Phone and portrait tablet: two equal columns side by side, each a short picture, its words, and a row of scans. */
export function competitiveTallLayout(input: CompetitiveTallInput): CompetitiveTallLayout {
  const { x, y, width, cardCounts } = input;
  const half = Math.floor((width - GAP / 2) / 2);
  const least = TALL_BANNER + TALL_LABEL + 6 + TALL_CARDS;
  const total = Math.round(Math.min(TALL_MAX, Math.max(least, input.room ?? 0)));
  // The extra height goes to the scans first (a third of it), then the picture.
  const cardsHeight = Math.max(TALL_CARDS, Math.round(total * 0.34));
  const bannerHeight = total - TALL_LABEL - 6 - cardsHeight;
  const make = (left: number, count: number): TeamColumnLayout => {
    const frame: Rect = { x: left, y, width: half, height: total };
    return {
      frame,
      banner: { x: left, y, width: half, height: bannerHeight },
      label: { x: left, y: y + bannerHeight, width: half, height: TALL_LABEL },
      cards: slots({ x: left, y: y + bannerHeight + TALL_LABEL + 6, width: half, height: cardsHeight }, count),
    };
  };
  const columns: [TeamColumnLayout, TeamColumnLayout] = [make(x, cardCounts[0]), make(x + width - half, cardCounts[1])];
  return { columns, bottom: y + total };
}
