/**
 * Where every zone sits, as pure functions.
 *
 * The scale manager runs in resize mode, so the Board scene asks this module
 * for rectangles and only draws them (PLAN.md Phase 4, "thin scenes, plain-TS
 * view models"). Nothing here imports Phaser, so the geometry is tested without
 * a canvas.
 *
 * The three layouts come from the design canvases:
 *  - `Board - Long Table` (desktop/tablet): a villain band across the top, the
 *    player band under it, hand and action bar at the bottom.
 *  - `Board - Phone`: one Board scene with a container per zone, chosen by a
 *    tab rail, with the hand and action bar fixed at the thumb on every tab
 *    (Components.dc.html section 06, "thumb parks the action").
 */

import { hit } from "../tokens.js";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** True when two rects share any pixel — the no-overlap check every layout's own test uses (S8, docs/phase4-screen-gaps.md §2). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * How many lines a string wraps to at `widthPx`, without a live Phaser text
 * object to measure — the same "conservative width estimate, no canvas" call
 * `chip-layout.ts` makes for a chip label, generalized to a whole sentence: a
 * greedy word-wrap over `text.length` at `avgCharWidthPx` per character
 * (never mid-word, so a long single "word" still counts as one line-worth of
 * its own length rather than being split).
 *
 * Exists because a fixed-height row sized for a *short* detail line clips or
 * collides with whatever sits below it once a longer one wraps twice or three
 * times (`view/pause-layout.ts` and `view/settings-layout.ts`'s own fidelity
 * pass notes — a two-line "Jump into the log" reason used to render its
 * second line through its own row's border; a three-line "Reduced motion"
 * description used to run into the next row's heading). Rows built from this
 * estimate size themselves to their own real content instead of a shared
 * worst case that wastes space under every shorter row.
 */
/**
 * The height a "title, then a detail line, then a toggle on the right" row
 * needs for its own detail text at `width` — the row shape Pause's inline
 * "Table" group and the standalone Settings screen both draw (`view/pause-layout.ts`,
 * `view/settings-layout.ts`, `scenes/pause.ts`'s `#drawTableRow`, `scenes/settings.ts`'s
 * `#drawRow` — one formula so the two screens can't drift into two different
 * row heights for what a player sees as the identical row).
 */
export function toggleRowHeight(detail: string, width: number): number {
  const DETAIL_TOP = 20;
  const DETAIL_LINE_HEIGHT = 14.5;
  const DETAIL_CHAR_WIDTH = 5.4;
  const BOTTOM_PADDING = 8;
  const MIN_HEIGHT = 44;
  const wrapWidth = Math.max(1, width - 100);
  const lines = estimateWrappedLines(detail, wrapWidth, DETAIL_CHAR_WIDTH);
  return Math.max(MIN_HEIGHT, DETAIL_TOP + lines * DETAIL_LINE_HEIGHT + BOTTOM_PADDING);
}

export function estimateWrappedLines(text: string, widthPx: number, avgCharWidthPx: number): number {
  const maxChars = Math.max(1, Math.floor(widthPx / avgCharWidthPx));
  let lines = 1;
  let lineLength = 0;
  for (const word of text.split(/\s+/).filter((w) => w.length > 0)) {
    const needed = lineLength === 0 ? word.length : lineLength + 1 + word.length;
    if (needed > maxChars && lineLength > 0) {
      lines += 1;
      lineLength = word.length;
    } else {
      lineLength = needed;
    }
  }
  return lines;
}

export type FormFactor = "phone" | "tabletPortrait" | "tabletLandscape" | "desktop";

/** The phone board's zone tabs, in the order the design canvas lists them. */
export const PHONE_TABS = ["threat", "enemies", "me", "team", "log"] as const;
export type PhoneTab = (typeof PHONE_TABS)[number];

export type ZoneName =
  /** Round chip, phase toggle, menu. Every in-game screen has one. */
  | "chrome"
  /** The phone board's tab rail. Null on wider layouts. */
  | "tabs"
  /** Main scheme, its threat meter, and the side schemes. */
  | "threat"
  /** Villain panel, minions, and the boost pile. */
  | "enemies"
  /** The perspective player's identity panel. */
  | "me"
  /** That player's upgrades, supports and allies. */
  | "playArea"
  /** The other seats, as compact rows. Null in a solo game. */
  | "team"
  /** Encounter deck and discard. */
  | "encounter"
  /** The virtualized game log. */
  | "log"
  | "hand"
  | "actionBar";

export interface BoardLayout {
  readonly formFactor: FormFactor;
  readonly viewport: Rect;
  /** Null means "this layout doesn't show that zone" (no team in solo, no tabs off phone). */
  readonly zones: Readonly<Record<ZoneName, Rect | null>>;
  /** True when only one of the tabbed zones is on screen at a time. */
  readonly tabbed: boolean;
  /** Which tabbed zone is showing. Null off phone, where they all are. */
  readonly activeTab: PhoneTab | null;
}

export interface LayoutOptions {
  /** Seats in the game. A solo game has no team strip. */
  readonly playerCount: number;
  /** Which phone tab is showing. Ignored off phone. */
  readonly activeTab?: PhoneTab;
}

/** A physical card is 2.5″ × 3.5″; every card slot keeps that ratio. */
export const CARD_ASPECT = 2.5 / 3.5;

/** The design canvases' reference viewports. */
export const REFERENCE_VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tabletPortrait: { width: 768, height: 1024 },
  tabletLandscape: { width: 1024, height: 768 },
  desktop: { width: 1440, height: 900 },
} as const;

/**
 * Breakpoints follow the reference viewports: under 768 CSS px wide is a phone,
 * up to 1280 is a tablet (portrait or landscape by orientation), wider is
 * desktop. The phone break is also where `resize_window`-style device emulation
 * switches to a touch layout.
 */
export function formFactorFor(width: number, height: number): FormFactor {
  if (width < 768) return "phone";
  if (width >= 1280) return "desktop";
  return width >= height ? "tabletLandscape" : "tabletPortrait";
}

const GUTTER = { phone: 8, tabletPortrait: 12, tabletLandscape: 12, desktop: 16 } as const;
const CHROME_HEIGHT = { phone: 36, tabletPortrait: 44, tabletLandscape: 44, desktop: 44 } as const;

/**
 * The phone action bar is two fixed rows on an ink ground: an abilities row at
 * the 44px touch target above a 52px commit row. Wider layouts put both in one
 * row, so the bar is the primary-CTA height.
 */
const actionBarHeight = (formFactor: FormFactor): number =>
  formFactor === "phone" || formFactor === "tabletPortrait" ? hit.target + hit.primary : hit.primary + 4;

/**
 * Which layout a viewport gets.
 *
 * The design set has two boards, and they are shaped by *orientation* rather
 * than by device: `Board - Long Table` spreads a villain band over a player
 * band and needs width, `Board - Phone` stacks one zone at a time and needs
 * height. A tablet held in portrait is 768×1024 — far closer to the phone's
 * tall, narrow shape than to a long table — and forcing it through the landscape
 * layout gave it a 84px-wide game log and a main scheme too narrow to show its
 * own card. So the tabbed layout covers both tall form factors.
 */
const isTabbed = (formFactor: FormFactor): boolean => formFactor === "phone" || formFactor === "tabletPortrait";

export function boardLayout(viewport: Rect, options: LayoutOptions): BoardLayout {
  const formFactor = formFactorFor(viewport.width, viewport.height);
  const tabbed = isTabbed(formFactor);
  const zones = tabbed ? phoneZones(viewport, options) : longTableZones(viewport, formFactor, options);
  return {
    formFactor,
    viewport,
    zones,
    tabbed,
    activeTab: tabbed ? (options.activeTab ?? "me") : null,
  };
}

type Zones = Record<ZoneName, Rect | null>;

/**
 * `Board - Phone`: chrome, tab rail, one full-width zone, then the hand and the
 * action bar parked at the thumb. Content scrolls under the bar; the bar never
 * scrolls away and its contents never reorder between screens.
 *
 * Only the active tab's zones get a rectangle — every other tabbed zone is
 * null, which is the same "this layout doesn't show that zone" the long table
 * uses for `team` in a solo game. Handing them all the *same* rectangle, as an
 * earlier version did, meant the Board drew five zones on top of one another.
 *
 * Two tabs hold more than one zone, because on the table those things are one
 * thing: "Me" is the identity panel with the play area under it, and "Enemies"
 * carries the encounter deck and discard in a strip above the enemies.
 */
function phoneZones(viewport: Rect, options: LayoutOptions): Zones {
  // A tablet in portrait uses this layout too, with its own gutters and chrome.
  const formFactor = formFactorFor(viewport.width, viewport.height);
  const gutter = GUTTER[formFactor];
  const chromeHeight = CHROME_HEIGHT[formFactor];
  const tabsHeight = hit.target;
  const barHeight = actionBarHeight(formFactor);
  // Enough for one row of fanned cards plus its "HAND 5 · Deck 28" caption.
  const handHeight = Math.min(230, Math.max(120, Math.round(viewport.height * 0.2)));
  const activeTab: PhoneTab = options.activeTab ?? "me";

  const chrome: Rect = { x: viewport.x, y: viewport.y, width: viewport.width, height: chromeHeight };
  const tabs: Rect = { x: viewport.x, y: chrome.y + chrome.height, width: viewport.width, height: tabsHeight };
  const actionBar: Rect = {
    x: viewport.x,
    y: viewport.y + viewport.height - barHeight,
    width: viewport.width,
    height: barHeight,
  };
  const hand: Rect = { x: viewport.x, y: actionBar.y - handHeight, width: viewport.width, height: handHeight };
  const content: Rect = {
    x: viewport.x + gutter,
    y: tabs.y + tabs.height + gutter,
    width: viewport.width - gutter * 2,
    height: hand.y - (tabs.y + tabs.height) - gutter * 2,
  };

  /** The active tab's content rect, or null when that tab isn't showing. */
  const on = (tab: PhoneTab, rect: Rect = content): Rect | null => (activeTab === tab ? rect : null);

  // "Me": identity above, play area below, split so the identity panel keeps
  // the proportions it has on the long table rather than filling the screen.
  const identityHeight = Math.round(content.height * 0.44);
  const me = on("me", { ...content, height: identityHeight });
  const playArea = on("me", {
    ...content,
    y: content.y + identityHeight + gutter,
    height: content.height - identityHeight - gutter,
  });

  // "Enemies": a pile strip across the top, the enemies under it.
  const pileHeight = Math.min(76, Math.round(content.height * 0.2));
  const encounter = on("enemies", { ...content, height: pileHeight });
  const enemies = on("enemies", {
    ...content,
    y: content.y + pileHeight + gutter,
    height: content.height - pileHeight - gutter,
  });

  return {
    chrome,
    tabs,
    threat: on("threat"),
    enemies,
    me,
    playArea,
    team: options.playerCount > 1 ? on("team") : null,
    encounter,
    log: on("log"),
    hand,
    actionBar,
  };
}

/**
 * `Board - Long Table`: a villain band (schemes left, villain and minions
 * centre, encounter piles right), a player band (identity, play area, other
 * heroes), then hand and action bar.
 */
function longTableZones(viewport: Rect, formFactor: FormFactor, options: LayoutOptions): Zones {
  const gutter = GUTTER[formFactor];
  const chromeHeight = CHROME_HEIGHT[formFactor];
  const barHeight = actionBarHeight(formFactor);
  const handHeight = Math.min(220, Math.max(150, Math.round(viewport.height * 0.24)));

  const chrome: Rect = { x: viewport.x, y: viewport.y, width: viewport.width, height: chromeHeight };
  const actionBar: Rect = {
    x: viewport.x,
    y: viewport.y + viewport.height - barHeight,
    width: viewport.width,
    height: barHeight,
  };
  const hand: Rect = { x: viewport.x, y: actionBar.y - handHeight, width: viewport.width, height: handHeight };

  const tableTop = chrome.y + chrome.height + gutter;
  const tableHeight = hand.y - tableTop - gutter;
  // The villain band carries the taller content (villain panel plus a minion row).
  const villainHeight = Math.round(tableHeight * 0.52);
  const playerTop = tableTop + villainHeight + gutter;
  const playerHeight = tableHeight - villainHeight - gutter;

  const left = viewport.x + gutter;
  const usable = viewport.width - gutter * 2;

  // Villain band: schemes · enemies · encounter piles.
  const encounterWidth = Math.round(Math.min(140, usable * 0.11));
  const schemesWidth = Math.round(usable * 0.3);
  const enemiesWidth = usable - schemesWidth - encounterWidth - gutter * 2;

  // Player band: identity · play area · other heroes (the strip only exists in multiplayer).
  const teamWidth = options.playerCount > 1 ? Math.round(Math.min(260, usable * 0.2)) : 0;
  const identityWidth = Math.round(Math.min(300, usable * 0.24));
  const playAreaWidth = usable - identityWidth - teamWidth - gutter * (teamWidth > 0 ? 2 : 1);

  // The log shares the encounter column, under the piles.
  const encounterPilesHeight = Math.round(villainHeight * 0.5);

  return {
    chrome,
    tabs: null,
    threat: { x: left, y: tableTop, width: schemesWidth, height: villainHeight },
    enemies: { x: left + schemesWidth + gutter, y: tableTop, width: enemiesWidth, height: villainHeight },
    encounter: {
      x: left + schemesWidth + enemiesWidth + gutter * 2,
      y: tableTop,
      width: encounterWidth,
      height: encounterPilesHeight,
    },
    log: {
      x: left + schemesWidth + enemiesWidth + gutter * 2,
      y: tableTop + encounterPilesHeight + gutter,
      width: encounterWidth,
      height: villainHeight - encounterPilesHeight - gutter,
    },
    me: { x: left, y: playerTop, width: identityWidth, height: playerHeight },
    playArea: { x: left + identityWidth + gutter, y: playerTop, width: playAreaWidth, height: playerHeight },
    team:
      teamWidth > 0
        ? { x: left + identityWidth + playAreaWidth + gutter * 2, y: playerTop, width: teamWidth, height: playerHeight }
        : null,
    hand,
    actionBar,
  };
}

/** Below this a compact villain panel stops reading as a panel at all — no room for a thumb plus a name. */
const VILLAIN_COMPACT_MIN_WIDTH = 74;
/** A compact villain panel's own minimum height, once wrapping into more than one row shrinks it. */
const VILLAIN_COMPACT_MIN_HEIGHT = 56;

/**
 * Where each villain's compact panel sits in the enemies band — The Wrecking Crew's four villains, or any later
 * scenario with more than one (`BoardModel.villains`). A single villain never calls this: `zones.ts` keeps its own
 * unchanged, full-size panel for that case, so every scenario before The Wrecking Crew looks exactly as it did.
 *
 * As many as fit across one row at `VILLAIN_COMPACT_MIN_WIDTH`; past that it wraps into more rows rather than
 * shrinking panels below where a name and its stats stop being legible — the same "crowd, don't vanish" rule
 * `cardRow` uses for the minions under it. Rows split as evenly as the count allows (four villains at three per row
 * would leave one alone on its own row for no reason), so a phone's narrow width and a tabletop's short height each
 * still get a legible grid instead of one badly-fit line or an unreadable four-wide squeeze.
 */
export function villainRowSlots(rect: Rect, count: number, gap = 8): readonly Rect[] {
  if (count <= 0) return [];
  const perRow = Math.max(1, Math.min(count, Math.floor((rect.width + gap) / (VILLAIN_COMPACT_MIN_WIDTH + gap))));
  const rows = Math.ceil(count / perRow);
  const rowHeight = Math.max(VILLAIN_COMPACT_MIN_HEIGHT, (rect.height - gap * (rows - 1)) / rows);

  const slots: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    const rowStart = row * perRow;
    const inRow = Math.min(perRow, count - rowStart);
    const width = (rect.width - gap * (inRow - 1)) / inRow;
    for (let col = 0; col < inRow; col++) {
      slots.push({ x: rect.x + col * (width + gap), y: rect.y + row * (rowHeight + gap), width, height: rowHeight });
    }
  }
  return slots;
}

/**
 * A card slot, tagged with which shape it got.
 *
 * "spine" is the fanned row's collapsed shape (`Board - Phone`'s hand once it
 * holds more cards than fit): a narrow strip standing in for a card that has
 * no room to show its face this draw, wide enough for a name running
 * vertically and a position number, not for a full card.
 */
export interface CardSlot extends Rect {
  readonly kind: "full" | "spine";
}

/**
 * How much narrower a collapsed "spine" slot is than a full card in the same
 * row, matched to `Board - Phone`'s own hand row (104px cards, 40px spines).
 */
const SPINE_WIDTH_RATIO = 0.38;

/**
 * Card slots laid across a rect in one row, keeping `CARD_ASPECT`.
 *
 * By default a row that's too wide shrinks every card down to a readable
 * floor and then overlaps rather than leaving the zone — used for the play
 * area and minion rows, so they crowd the same way a real tabletop does when
 * you run out of space in front of you.
 *
 * `options.fan` swaps that for `Board - Phone`'s hand: full-size cards for as
 * many as fit, then the rest collapsed to "spine" slots, left-aligned and
 * free to run past `bounds.width` rather than shrinking below a readable
 * size — the design scrolls this row instead of crowding it (PLAN.md Phase 4,
 * "the phone hand crowds at six cards"). `"expanded"` is the row's "Fan out"
 * pill: every card stays full-size and none collapse, at the cost of an even
 * longer scroll. Either way the scene owns turning the overflow into an
 * actual scroll offset; this stays a pure layout, so "how wide is the whole
 * row" and "which slots are collapsed" both stay testable without one.
 */
export function cardRow(
  bounds: Rect,
  count: number,
  options: {
    readonly gap?: number;
    readonly maxHeight?: number;
    readonly fan?: boolean | "expanded";
    /** Where a row narrower than its bounds sits. "start" lets a caller centre it together with something else (`view/hand-row.ts`). */
    readonly align?: "center" | "start";
  } = {},
): readonly CardSlot[] {
  if (count <= 0) return [];
  const gap = options.gap ?? 6;
  const height = Math.min(bounds.height, options.maxHeight ?? bounds.height);
  const widthAtFullHeight = height * CARD_ASPECT;
  const needed = widthAtFullHeight * count + gap * (count - 1);

  if (options.fan && needed > bounds.width) {
    return fannedRow(bounds, count, gap, height, widthAtFullHeight, options.fan === "expanded");
  }

  // Too wide: shrink the cards until the row fits, down to a readable floor.
  const scale = needed <= bounds.width ? 1 : Math.max(0.35, (bounds.width - gap * (count - 1)) / (widthAtFullHeight * count));
  const cardHeight = height * scale;
  const cardWidth = cardHeight * CARD_ASPECT;
  const rowWidth = cardWidth * count + gap * (count - 1);
  // Overlap when even the floor doesn't fit, so the row never leaves the zone.
  const step = rowWidth <= bounds.width ? cardWidth + gap : (bounds.width - cardWidth) / Math.max(1, count - 1);
  const startX = rowWidth <= bounds.width && options.align !== "start" ? bounds.x + (bounds.width - rowWidth) / 2 : bounds.x;

  return Array.from({ length: count }, (_unused, index) => ({
    x: startX + step * index,
    y: bounds.y + (bounds.height - cardHeight) / 2,
    width: cardWidth,
    height: cardHeight,
    kind: "full",
  }));
}

/**
 * As many full-size cards as fit at the row's own height, then the remainder
 * as spines, both left-aligned starting at `bounds.x` and never shrunk or
 * overlapped — the row's true width may exceed `bounds.width`, which is the
 * point: the scene clips or scrolls to it rather than this function lying
 * about how much room the hand actually needs. `expanded` forces every card
 * to stay full-size instead of collapsing whatever doesn't fit.
 */
function fannedRow(
  bounds: Rect,
  count: number,
  gap: number,
  cardHeight: number,
  cardWidth: number,
  expanded: boolean,
): readonly CardSlot[] {
  const capacity = expanded ? count : Math.max(1, Math.floor((bounds.width + gap) / (cardWidth + gap)));
  const fullCount = Math.min(count, capacity);
  const spineWidth = Math.round(cardWidth * SPINE_WIDTH_RATIO);
  const y = bounds.y + (bounds.height - cardHeight) / 2;

  const slots: CardSlot[] = [];
  let x = bounds.x;
  for (let index = 0; index < fullCount; index += 1) {
    slots.push({ x, y, width: cardWidth, height: cardHeight, kind: "full" });
    x += cardWidth + gap;
  }
  for (let index = fullCount; index < count; index += 1) {
    slots.push({ x, y, width: spineWidth, height: cardHeight, kind: "spine" });
    x += spineWidth + gap;
  }
  return slots;
}

/** Where one stat badge sits: its starburst's centre and its diameter. */
export interface BadgeSlot {
  readonly cx: number;
  readonly cy: number;
  readonly size: number;
}

/** A panel's stats, laid out: one slot per badge, and the hit-point plate. */
export interface StatBlock {
  readonly badges: readonly BadgeSlot[];
  readonly hp: Rect | null;
  /** How much of the host rect the block occupies, so content above it can stop short. */
  readonly height: number;
  /** The block's own top edge, so a caller can check "does my content clear it?" without redoing this math. */
  readonly top: number;
}

/** A badge never grows past this, however wide the panel; past it the number just floats in colour. */
export const BADGE_MAX = 46;
const BADGE_GAP = 6;
/** Below this a starburst stops reading as one. Layout shrinks toward it, never past. */
const BADGE_FLOOR = 12;

/** The ink ribbon carrying a badge's stat name. */
export const ribbonHeight = (size: number): number => Math.max(9, Math.round(size * 0.3));

/** How far a badge reaches above and below its starburst's centre, ribbon included. */
export function badgeExtent(size: number): { readonly above: number; readonly below: number } {
  return { above: size / 2, below: size * 0.34 + ribbonHeight(size) };
}

/**
 * Stats for a wide panel (an identity, the villain): badges in a row, the HP
 * plate full-width under them, the whole block pinned to the bottom of `rect`.
 *
 * Badges share the width evenly up to `BADGE_MAX`, so three hero stats in a
 * ~110px column come out around 34px each — larger than the old 17px numbers
 * in 25px boxes, whose labels overlapped into "TH|AT|DE".
 *
 * The badge size also shrinks toward `BADGE_FLOOR` when `rect.height` can't
 * hold a `BADGE_MAX` row plus the HP plate — `cardStatColumn` already does
 * this for a card-shaped panel. Without it, a caller passing the panel's
 * *full* column height (rather than what's left under the name/subtitle it
 * already drew) got a badge row bottom-pinned so tall it started above where
 * the header text ended: the villain panel's fixed 128px height gave a
 * two-stat row + HP plate no room to sit under "Villain · Stage II" without
 * the badges being drawn — later, and so on top — right over it.
 */
export function statBlockLayout(rect: Rect, count: number, withHp: boolean): StatBlock {
  const hpHeight = withHp ? Math.max(24, Math.min(38, Math.round(rect.width * 0.26))) : 0;
  let size =
    count > 0 ? Math.max(BADGE_FLOOR, Math.min(BADGE_MAX, Math.floor((rect.width - BADGE_GAP * (count - 1)) / count))) : 0;
  const requiredHeight = (candidate: number): number => {
    if (count === 0) return hpHeight;
    const { above, below } = badgeExtent(candidate);
    return Math.ceil(above + below) + (withHp ? BADGE_GAP : 0) + hpHeight;
  };
  while (size > BADGE_FLOOR && requiredHeight(size) > rect.height) size -= 1;
  const { above, below } = badgeExtent(size);
  const rowHeight = count > 0 ? Math.ceil(above + below) : 0;
  const hpGap = withHp && count > 0 ? BADGE_GAP : 0;
  const height = rowHeight + hpGap + hpHeight;
  // Clamped at `rect.y`: past the floor there is nothing left to shrink, and
  // the block staying inside `rect` at least keeps it off whatever is above `rect` entirely.
  const top = Math.max(rect.y, rect.y + rect.height - height);
  const rowWidth = count * size + BADGE_GAP * Math.max(0, count - 1);
  const startX = rect.x + (rect.width - rowWidth) / 2;
  const badges = Array.from({ length: count }, (_unused, index) => ({
    cx: startX + size / 2 + index * (size + BADGE_GAP),
    cy: top + above,
    size,
  }));
  const hp = withHp ? { x: rect.x, y: top + rowHeight + hpGap, width: rect.width, height: hpHeight } : null;
  return { badges, hp, height, top };
}

/**
 * Stats for a card-shaped panel (an ally, a minion): badges stacked down the
 * left edge, where the printed card puts its own stat icons, and the HP plate
 * along the foot.
 *
 * Over the printed icons on purpose. The scan still shows the *base* numbers;
 * an opaque badge in the same spot replaces a stale printed value with the
 * live one instead of leaving two numbers for one stat. A short card shrinks
 * its badges until the stack clears the HP plate, rather than overrunning it.
 */
export function cardStatColumn(inner: Rect, count: number, withHp: boolean): StatBlock {
  const hpHeight = withHp ? Math.max(14, Math.min(28, Math.round(inner.height * 0.13))) : 0;
  const hpTop = inner.y + inner.height - hpHeight;
  const startTop = inner.y + Math.round(inner.height * 0.18);
  const bottom = withHp ? hpTop - 4 : inner.y + inner.height;
  const room = Math.max(0, bottom - startTop);
  const stack = (size: number): number => {
    const { above, below } = badgeExtent(size);
    return count * (above + below) + Math.max(0, count - 1) * 3;
  };
  let size = count > 0 ? Math.max(BADGE_FLOOR, Math.min(BADGE_MAX, Math.round(inner.width * 0.3))) : 0;
  while (size > BADGE_FLOOR && stack(size) > room) size -= 1;
  const { above, below } = badgeExtent(size);
  const cx = inner.x + size / 2 + 2;
  const badges = Array.from({ length: count }, (_unused, index) => ({
    cx,
    cy: startTop + above + index * (above + below + 3),
    size,
  }));
  const hp = withHp ? { x: inner.x, y: hpTop, width: inner.width, height: hpHeight } : null;
  return { badges, hp, height: inner.y + inner.height - startTop, top: startTop };
}
