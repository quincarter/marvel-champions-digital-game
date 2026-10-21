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

import { desktopTypeSize } from "./desktop-type.js";
import { hit } from "../tokens.js";
import { villainRowPlan, villainRowSlotsFor } from "./villain-tile-layout.js";

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
 * `McScrollRegion`'s own `heights` array from a list of content-space rects already stacked top to bottom with
 * their own inter-row gaps baked into `y` — each slot spans from its own row's top to the *next* row's top, so
 * the gap after a row is folded into that row's own slot rather than dropped. A plain `rects.map(r => r.height)`
 * undercounts the real stacked height by every gap between rows, and `VariableListScroll`'s own scroll math
 * (`#maxOffset`, `topOf`) only ever sums this array — so a gapless `heights` array drifts further from each
 * row's real screen position the more rows are scrolled past, and eventually can't scroll far enough to bring
 * the last rows fully into view. Found in browser verification, 2026-09-26: Pause's merged Table/Guide region
 * (docs/guided-mode.md §4 G2b) left an earlier row's own detail text still readable under the "Jump into the
 * log" quick-reference card after scrolling well past it, because the region's own offset undershot where that
 * row had actually been drawn.
 */
export function contentSlotHeights(rects: readonly Rect[]): number[] {
  return rects.map((rect, i) => (i + 1 < rects.length ? rects[i + 1]!.y - rect.y : rect.height));
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
export function toggleRowHeight(detail: string, width: number, onDesktop = false): number {
  // The detail is drawn at 10px, which desktop draws a size up (`view/desktop-type.ts`): wider glyphs, taller lines.
  const grow = desktopTypeSize(10, onDesktop) / 10;
  const DETAIL_TOP = 20;
  const DETAIL_LINE_HEIGHT = 14.5 * grow;
  const DETAIL_CHAR_WIDTH = 5.4 * grow;
  const BOTTOM_PADDING = 8;
  const MIN_HEIGHT = 44;
  const wrapWidth = Math.max(1, width - 100);
  const lines = estimateWrappedLines(detail, wrapWidth, DETAIL_CHAR_WIDTH);
  return Math.max(MIN_HEIGHT, DETAIL_TOP + lines * DETAIL_LINE_HEIGHT + BOTTOM_PADDING);
}

/**
 * The height a campaign log write row needs — a headline (itself sometimes multi-line: a collapsed cardList delta
 * like "+ Brainstorm, By Any Means, Contingency Plan → Groot" can wrap), then a detail line, with a citation
 * pinned top-right in its own reserved column (`scenes/campaign/issue.ts`'s "Wrote to the log" list and the
 * Dossier's Log tab share this exact row shape, so one formula keeps them from drifting apart the way
 * `toggleRowHeight` already does for Pause/Settings' own shared row).
 */
export function logWriteRowHeight(headline: string, detail: string, width: number, citationColumnWidth = 150): number {
  const TOP = 8;
  const HEADLINE_LINE_HEIGHT = 15;
  const HEADLINE_CHAR_WIDTH = 6.4;
  const DETAIL_GAP = 4;
  const DETAIL_LINE_HEIGHT = 13;
  const DETAIL_CHAR_WIDTH = 5.2;
  const BOTTOM_PADDING = 12;
  const MIN_HEIGHT = 42;
  const wrapWidth = Math.max(1, width - citationColumnWidth);
  const headlineLines = estimateWrappedLines(headline, wrapWidth, HEADLINE_CHAR_WIDTH);
  const detailLines = estimateWrappedLines(detail, wrapWidth, DETAIL_CHAR_WIDTH);
  const detailTop = TOP + headlineLines * HEADLINE_LINE_HEIGHT + DETAIL_GAP;
  return Math.max(MIN_HEIGHT, detailTop + detailLines * DETAIL_LINE_HEIGHT + BOTTOM_PADDING);
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

export type FormFactor = "phone" | "phoneLandscape" | "tabletPortrait" | "tabletLandscape" | "desktop";

/**
 * Below this height a landscape viewport is a phone on its side, whatever its width: a Pixel or an iPhone held
 * sideways is 850–930 wide and 380–430 tall, which width alone reads as a tablet. A real tablet in landscape is
 * never under 600 tall.
 */
export const PHONE_LANDSCAPE_MAX_HEIGHT = 500;
/** The landscape phone board's tab rail, a column down the left edge. Wide enough for "ENEMIES" and a badge. */
export const PHONE_LANDSCAPE_RAIL_WIDTH = 84;

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
  /**
   * The window the scrolling table content is seen through: the band between the pinned chrome (and the phone's tab
   * row) above and the pinned hand and action bar below. At card scale 1 the content is exactly this tall.
   */
  readonly tableWindow: Rect;
  /**
   * How tall the scrolling content is, measured from `tableWindow.y` down to the bottom of its last zone and the
   * gutter under it. Equal to `tableWindow.height` at scale 1 (nothing scrolls); taller at a larger card scale.
   */
  readonly contentHeight: number;
  /** How far the content can scroll: `contentHeight - tableWindow.height`, never negative. 0 at scale 1. */
  readonly maxScroll: number;
  /** How far the zones have been scrolled (`scrollLayout`); 0 from `boardLayout`, whose zones are at rest. */
  readonly scrollY: number;
  /**
   * True when the player band is the compact row under a tall villain band (`LayoutOptions.villainBand`): `me` and
   * `playArea` are short strips drawn as a mini identity and a thumbnail row. Absent otherwise.
   */
  readonly compactPlayerRow?: boolean;
}

export interface LayoutOptions {
  /** Seats in the game. A solo game has no team strip. */
  readonly playerCount: number;
  /**
   * The scenario has a neutral play area (God of Lies): the villain band is given room for it under the villain and its
   * environments on a short table, out of the player band's spare room (`longTableZones`).
   */
  readonly neutralArea?: boolean;
  /** Which phone tab is showing. Ignored off phone. */
  readonly activeTab?: PhoneTab;
  /**
   * The guide side rail (guided mode G4b, `docs/guided-mode.md` §4), when open on desktop or tablet
   * landscape — `McGuidePanel`'s own width (`guideRailWidthFor` in `view/guide-panel-model.ts`) and which
   * edge it occupies. The board's zones are laid out in whatever width is left, so nothing the rail
   * covers is ever also a drop target underneath it. `null`/omitted lays the board out full-width, as
   * every screen does today.
   */
  readonly guideRail?: { readonly side: "left" | "right"; readonly width: number };
  /**
   * The width the villain phase panel takes on the right while it is docked beside the table (desktop, D1/D2 in
   * `artifacts/design-screenshots/villain-phase/`). Carved off after the guide rail, under the chrome band like it, so
   * the table and the hand stay in view and live beside the phase. Omitted or 0 lays the board out as usual.
   */
  readonly villainDock?: number;
  /**
   * The villain phase docked as the band over the long table (tablet landscape; `villainDockRects("band")`). With
   * `tall` set (a defend decision or the recap, TB1/TB2) the band takes the villain band and most of the player
   * band: the hero, the play area and the other seats shrink to one compact row (`BoardLayout.compactPlayerRow`)
   * between the band and the hand. Omitted or `tall: false`: the player band keeps its usual height.
   */
  readonly villainBand?: {
    readonly tall: boolean;
    /** 0..1, how far the band has grown while it animates (1 when omitted); past half the row draws compact. */
    readonly grow?: number;
  };
  /**
   * The Card size setting's factor (`cardSizeFactor` in `settings.ts`: 1, 1.25 or 1.5), 1 when omitted. Above 1 the
   * table's zones are laid out that much taller than the room between the pinned bands, so the card slots in them
   * grow, and `maxScroll` says how far the content scrolls. The hand grows too, up to a cap that leaves the table a
   * usable window. Width does not change.
   */
  readonly cardScale?: number;
  /**
   * The villain review handle's width while it shows on the table's right edge (`view/villain-review.ts`). On the tabbed
   * board (phones, tablet portrait) the play area runs to that edge, so it stops this much short: no card sits under
   * the handle (#227). Ignored on the long table. Omitted or 0: the play area keeps its full width.
   */
  readonly reviewHandle?: number;
}

/** The scale a layout is built at: 1 when omitted, never below 1 and never past 2 (a layout only ever grows). */
const scaleOf = (options: LayoutOptions): number => Math.min(2, Math.max(1, options.cardScale ?? 1));

/** The hand's height at `scale`: grown with it, but never past `capShare` of the viewport (or the unscaled height, if taller). */
const scaledHand = (base: number, scale: number, viewportHeight: number, capShare: number): number =>
  scale <= 1 ? base : Math.min(Math.max(base, Math.round(viewportHeight * capShare)), Math.round(base * scale));

/** The zones that scroll with the table; the rest are pinned. */
export const SCROLLING_ZONES: readonly ZoneName[] = ["threat", "enemies", "me", "playArea", "team", "encounter", "log"];

/**
 * The layout with its scrolling zones moved to `scrollY` (clamped to `0..maxScroll`): every zone then holds the screen
 * rectangle it is drawn at, so hit rects, focus rects and every overlay that anchors to a zone stay in screen space.
 * The pinned zones (chrome, tabs, hand, action bar) never move. Pure: `layout` is not changed.
 */
export function scrollLayout(layout: BoardLayout, scrollY: number): BoardLayout {
  const offset = Math.min(layout.maxScroll, Math.max(0, Math.round(scrollY)));
  if (offset === layout.scrollY) return layout;
  const delta = layout.scrollY - offset;
  const zones = { ...layout.zones } as Record<ZoneName, Rect | null>;
  for (const name of SCROLLING_ZONES) {
    const rect = zones[name];
    if (rect) zones[name] = { ...rect, y: rect.y + delta };
  }
  return { ...layout, zones, scrollY: offset };
}

/** A physical card is 2.5″ × 3.5″; every card slot keeps that ratio. */
export const CARD_ASPECT = 2.5 / 3.5;

/**
 * The narrowest a wide character panel's text column may get before the panel
 * stops being "card plus numbers" and becomes the card itself. Below this the
 * name wraps to one word a line and the stat tiles have nowhere to sit.
 */
export const PANEL_TEXT_MIN_WIDTH = 104;

/**
 * What a wide panel spends across its width besides the card and the text
 * column: the 3px frame inset before the card, the gap and rule between card
 * and text, and the 8px inset after the text (`character-panel.ts`).
 */
export const PANEL_TEXT_INSETS = 22;

/** The frame inset above and below a wide panel's card. */
const PANEL_CARD_INSET = 3;

/**
 * How wide a wide character panel has to be for a card as tall as the panel
 * allows to sit beside a `PANEL_TEXT_MIN_WIDTH` text column — a whole card,
 * never cropped, with room for the name, the statuses and the attachment
 * chips next to it.
 */
export function widePanelWidthFor(panelHeight: number): number {
  return Math.round((panelHeight - PANEL_CARD_INSET * 2) * CARD_ASPECT) + PANEL_TEXT_MIN_WIDTH + PANEL_TEXT_INSETS;
}

/**
 * The two shapes a character panel takes: `"wide"` puts the card in a column
 * with the live numbers, statuses and attachment chips beside it; `"card"` is
 * the slot *as* the card, with only the numbers riding on top.
 */
export type PanelShape = "wide" | "card";

/**
 * Which shape a character panel gets in `rect`.
 *
 * `"auto"` reads the rect: a slot already roughly card-shaped (a minion in a
 * row, an ally in the play area) is the card, and anything wider gets the
 * column beside it. `"wide"` is for the perspective player's identity, which
 * is always the wide panel: its attachments only show as chips beside the
 * card, and its scan is shown whole so the printed rules text can be read.
 * On a tall window — a maximized 16″ MacBook, a 1920×1080 display — the
 * identity's slot comes out taller than it is wide, and reading the rect
 * sent it through the card shape, which crops the scan to cover the slot and
 * draws no attachments at all: the very things the wide panel exists to show.
 */
export function panelShape(rect: Rect, preferred: PanelShape | "auto" = "auto"): PanelShape {
  if (preferred !== "auto") return preferred;
  return rect.width < PANEL_TEXT_MIN_WIDTH + 60 || rect.width < rect.height * 0.95 ? "card" : "wide";
}

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
  if (height < PHONE_LANDSCAPE_MAX_HEIGHT && width > height) return "phoneLandscape";
  if (width >= 1280) return "desktop";
  return width >= height ? "tabletLandscape" : "tabletPortrait";
}

const GUTTER = { phone: 8, phoneLandscape: 6, tabletPortrait: 12, tabletLandscape: 12, desktop: 16 } as const;
export const CHROME_HEIGHT = {
  phone: 36,
  phoneLandscape: 32,
  tabletPortrait: 44,
  tabletLandscape: 44,
  desktop: 44,
} as const;

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
/** Exported for the guide's phone/tablet-portrait callout path (guided mode G5c part 2, `docs/guided-mode.md` §4):
 * which form factors show one zone at a time, and therefore get `McGuideCallout` instead of the desktop/tablet-
 * landscape `McGuidePanel` rail (`scenes/board/guide-mount.ts`). */
export const isTabbed = (formFactor: FormFactor): boolean =>
  formFactor === "phone" || formFactor === "phoneLandscape" || formFactor === "tabletPortrait";

/** `viewport` with the guide rail's own width carved off its `side` edge, for every zone below it to lay out in. */
function insetForGuideRail(viewport: Rect, rail: { readonly side: "left" | "right"; readonly width: number }): Rect {
  const width = Math.max(0, viewport.width - rail.width);
  const x = rail.side === "left" ? viewport.x + rail.width : viewport.x;
  return { x, y: viewport.y, width, height: viewport.height };
}

export function boardLayout(viewport: Rect, options: LayoutOptions): BoardLayout {
  const formFactor = formFactorFor(viewport.width, viewport.height);
  const tabbed = isTabbed(formFactor);
  // The rail sits *under* the chrome band, matching the design canvases (D01/D02, T02): the top bar
  // ("RD1 · PLAYER/VILLAIN · MENU") always spans the full screen, and only the content below it — schemes,
  // enemies, the identity panel and so on — narrows to make room. So `chrome` is always laid out against the
  // real, full-width `viewport`; every other zone gets the inset one.
  const railed = options.guideRail ? insetForGuideRail(viewport, options.guideRail) : viewport;
  const boardViewport = options.villainDock
    ? insetForGuideRail(railed, { side: "right", width: options.villainDock })
    : railed;
  const placed =
    formFactor === "phoneLandscape"
      ? phoneLandscapeZones(boardViewport, options, viewport)
      : tabbed
        ? phoneZones(boardViewport, options, viewport)
        : longTableZones(boardViewport, formFactor, options, viewport);
  return {
    formFactor,
    viewport,
    zones: placed.zones,
    tabbed,
    activeTab: tabbed ? (options.activeTab ?? "me") : null,
    tableWindow: placed.tableWindow,
    contentHeight: placed.contentHeight,
    maxScroll: Math.max(0, placed.contentHeight - placed.tableWindow.height),
    scrollY: 0,
    ...(placed.compactPlayerRow ? { compactPlayerRow: true } : {}),
  };
}

type Zones = Record<ZoneName, Rect | null>;

/** What each form factor's zone function returns: the zones at rest, the window they scroll in, and their height. */
interface ZonesAndScroll {
  readonly zones: Zones;
  readonly tableWindow: Rect;
  readonly contentHeight: number;
  readonly compactPlayerRow?: boolean;
}

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
function phoneZones(viewport: Rect, options: LayoutOptions, fullViewport: Rect = viewport): ZonesAndScroll {
  // A tablet in portrait uses this layout too, with its own gutters and chrome.
  const formFactor = formFactorFor(viewport.width, viewport.height);
  const gutter = GUTTER[formFactor];
  const chromeHeight = CHROME_HEIGHT[formFactor];
  const tabsHeight = hit.target;
  const barHeight = actionBarHeight(formFactor);
  // Enough for one row of fanned cards plus its "HAND 5 · Deck 28" caption.
  const baseHandHeight = Math.min(230, Math.max(120, Math.round(viewport.height * 0.2)));
  const scale = scaleOf(options);
  const handHeight = scaledHand(baseHandHeight, scale, viewport.height, 0.26);
  const activeTab: PhoneTab = options.activeTab ?? "me";

  const chrome: Rect = { x: fullViewport.x, y: fullViewport.y, width: fullViewport.width, height: chromeHeight };
  const tabs: Rect = { x: viewport.x, y: chrome.y + chrome.height, width: viewport.width, height: tabsHeight };
  const actionBar: Rect = {
    x: viewport.x,
    y: viewport.y + viewport.height - barHeight,
    width: viewport.width,
    height: barHeight,
  };
  const hand: Rect = { x: viewport.x, y: actionBar.y - handHeight, width: viewport.width, height: handHeight };
  // As tall as the room between the tab row and the *unscaled* hand, times the card scale; the part past the window scrolls.
  const content: Rect = {
    x: viewport.x + gutter,
    y: tabs.y + tabs.height + gutter,
    width: viewport.width - gutter * 2,
    height: Math.round((actionBar.y - baseHandHeight - (tabs.y + tabs.height) - gutter * 2) * scale),
  };
  const tableWindow: Rect = {
    x: fullViewport.x,
    y: tabs.y + tabs.height,
    width: fullViewport.width,
    height: hand.y - (tabs.y + tabs.height),
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
    width: content.width - (options.reviewHandle ?? 0),
    height: content.height - identityHeight - gutter,
  });

  // "Enemies": a pile strip across the top, the enemies under it.
  const pileHeight = Math.min(Math.round(76 * scale), Math.round(content.height * 0.2));
  const encounter = on("enemies", { ...content, height: pileHeight });
  const enemies = on("enemies", {
    ...content,
    y: content.y + pileHeight + gutter,
    height: content.height - pileHeight - gutter,
  });

  return {
    zones: {
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
    },
    tableWindow,
    contentHeight: content.y + content.height + gutter - tableWindow.y,
  };
}

/**
 * A phone on its side. Still the tabbed board — the long table needs twice this height — but laid out for a
 * viewport that is wide and about 400 tall, where the portrait stack (chrome, tabs, content, hand, a two-row action
 * bar) leaves the content nothing:
 *
 * - the tab rail is a column down the left edge instead of a row, so it costs width, which there is plenty of;
 * - the action bar is the long table's single row;
 * - within a tab, what portrait stacks is set side by side: identity beside play area, piles beside enemies.
 *
 * Reported from play (2026-09-21): the long-table layout at this height drew the play area over the villain and
 * was "virtually unusable".
 */
function phoneLandscapeZones(viewport: Rect, options: LayoutOptions, fullViewport: Rect = viewport): ZonesAndScroll {
  const gutter = GUTTER.phoneLandscape;
  const chromeHeight = CHROME_HEIGHT.phoneLandscape;
  // The long table's single row: End turn beside the basic powers, tall enough for its 42px button.
  const barHeight = hit.primary;
  const railWidth = PHONE_LANDSCAPE_RAIL_WIDTH;
  const baseHandHeight = Math.min(150, Math.max(96, Math.round(viewport.height * 0.3)));
  const scale = scaleOf(options);
  const handHeight = scaledHand(baseHandHeight, scale, viewport.height, 0.34);
  const activeTab: PhoneTab = options.activeTab ?? "me";

  const chrome: Rect = { x: fullViewport.x, y: fullViewport.y, width: fullViewport.width, height: chromeHeight };
  const actionBar: Rect = {
    x: viewport.x,
    y: viewport.y + viewport.height - barHeight,
    width: viewport.width,
    height: barHeight,
  };
  const hand: Rect = {
    x: viewport.x + railWidth,
    y: actionBar.y - handHeight,
    width: viewport.width - railWidth,
    height: handHeight,
  };
  const tabs: Rect = {
    x: viewport.x,
    y: chrome.y + chrome.height,
    width: railWidth,
    height: actionBar.y - (chrome.y + chrome.height),
  };
  const content: Rect = {
    x: tabs.x + tabs.width + gutter,
    y: chrome.y + chrome.height + gutter,
    width: viewport.width - railWidth - gutter * 2,
    height: Math.round((actionBar.y - baseHandHeight - (chrome.y + chrome.height) - gutter * 2) * scale),
  };
  // Beside the pinned rail, which never sits under the scrolling content.
  const tableWindow: Rect = {
    x: tabs.x + tabs.width,
    y: chrome.y + chrome.height,
    width: viewport.width - railWidth,
    height: hand.y - (chrome.y + chrome.height),
  };

  const on = (tab: PhoneTab, rect: Rect = content): Rect | null => (activeTab === tab ? rect : null);

  const identityWidth = Math.round(content.width * 0.42);
  const me = on("me", { ...content, width: identityWidth });
  const playArea = on("me", {
    ...content,
    x: content.x + identityWidth + gutter,
    width: content.width - identityWidth - gutter - (options.reviewHandle ?? 0),
  });

  const pileWidth = Math.min(150, Math.round(content.width * 0.2));
  const encounter = on("enemies", { ...content, width: pileWidth });
  const enemies = on("enemies", {
    ...content,
    x: content.x + pileWidth + gutter,
    width: content.width - pileWidth - gutter,
  });

  return {
    zones: {
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
    },
    tableWindow,
    contentHeight: content.y + content.height + gutter - tableWindow.y,
  };
}

/**
 * `Board - Long Table`: a villain band (schemes left, villain and minions
 * center, encounter piles right), a player band (identity, play area, other
 * heroes), then hand and action bar.
 */
function longTableZones(
  viewport: Rect,
  formFactor: FormFactor,
  options: LayoutOptions,
  fullViewport: Rect = viewport,
): ZonesAndScroll {
  const gutter = GUTTER[formFactor];
  const chromeHeight = CHROME_HEIGHT[formFactor];
  const barHeight = actionBarHeight(formFactor);
  // `grow` (0..1) is how far the band has grown while it animates (`BoardScene.setVillainDock`); past half the row draws compact.
  const grow =
    formFactor === "tabletLandscape" && options.villainBand?.tall === true
      ? Math.min(1, Math.max(0, options.villainBand.grow ?? 1))
      : 0;
  // 220 is the 1440x900 hand. A viewport well past that (an ultrawide's 1440 rows) lets it grow with the screen, so a
  // hand card is not a thumbnail beside a play area card two and a half times its size.
  const usualHandHeight = Math.min(
    viewport.height > 1100 ? Math.min(380, Math.round(viewport.height * 0.24)) : 220,
    Math.max(150, Math.round(viewport.height * 0.24)),
  );
  // While the band is tall the hand gives up a third of its height: the panel is what the player is reading.
  const tallHandHeight = Math.max(120, Math.round(usualHandHeight * 0.65));
  const baseHandHeight = Math.round(usualHandHeight + (tallHandHeight - usualHandHeight) * grow);
  const scale = scaleOf(options);
  const handHeight = scaledHand(baseHandHeight, scale, viewport.height, 0.3);

  const chrome: Rect = { x: fullViewport.x, y: fullViewport.y, width: fullViewport.width, height: chromeHeight };
  const actionBar: Rect = {
    x: viewport.x,
    y: viewport.y + viewport.height - barHeight,
    width: viewport.width,
    height: barHeight,
  };
  const hand: Rect = { x: viewport.x, y: actionBar.y - handHeight, width: viewport.width, height: handHeight };

  const tableTop = chrome.y + chrome.height + gutter;
  // As tall as the room between the chrome and the *unscaled* hand, times the card scale; the part past the window scrolls.
  const tableHeight = Math.round((actionBar.y - baseHandHeight - tableTop - gutter) * scale);
  const tableWindow: Rect = {
    x: viewport.x,
    y: chrome.y + chrome.height,
    width: viewport.width,
    height: hand.y - (chrome.y + chrome.height),
  };
  // The villain band carries the taller content (villain panel plus a minion row).
  // A neutral strip (label, a wide card, the line under it: 104) joins the villain and a two-row environment grid
  // (136) in the band on a table too short for both at 52%; the player band gives up the difference.
  const neutralFloor = options.neutralArea ? Math.min(Math.round(tableHeight * 0.6), 104 + 8 + 136 + 22) : 0;
  // A tall docked villain band (TB1/TB2) leaves the player band one compact row: a mini identity, a thumbnail strip.
  const compactRow = grow >= 0.5;
  const compactHeight = Math.min(96, Math.max(72, Math.round(tableHeight * 0.17)));
  const normalVillainHeight = Math.max(Math.round(tableHeight * 0.52), neutralFloor);
  const villainHeight = Math.round(
    normalVillainHeight + (tableHeight - compactHeight - gutter - normalVillainHeight) * grow,
  );
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
  // The identity column grows with the band, so its card is shown whole at the
  // band's height with a readable text column beside it. A fixed 24% column
  // was fine on the 1440×900 canvas, but a taller window (a maximized 16″
  // MacBook, a 1920×1080 display) made the band taller without making the
  // column wider, so the card either shrank to fit the width with dead panel
  // under it or, past a point, the slot read as card-shaped and cropped it.
  // Capped at 30% so the play area keeps most of the band; past that the
  // card simply doesn't fill the height, which is the lesser loss.
  const normalIdentityWidth = Math.min(
    Math.max(Math.min(300, usable * 0.24), widePanelWidthFor(tableHeight - normalVillainHeight - gutter)),
    usable * 0.3,
  );
  const identityWidth = Math.round(normalIdentityWidth + (Math.min(300, usable * 0.34) - normalIdentityWidth) * grow);
  const playAreaWidth = usable - identityWidth - teamWidth - gutter * (teamWidth > 0 ? 2 : 1);

  // The log shares the encounter column, under the piles.
  const encounterPilesHeight = Math.round(villainHeight * 0.5);

  const zones: Zones = {
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
  return {
    zones,
    tableWindow,
    contentHeight: tableTop + tableHeight + gutter - tableWindow.y,
    ...(compactRow ? { compactPlayerRow: true } : {}),
  };
}

/**
 * Where each villain's compact tile sits in the enemies band — The Wrecking Crew's four villains, or any later
 * scenario with more than one (`BoardModel.villains`). A single villain never calls this: `zones.ts` keeps its own
 * unchanged, full-size panel for that case, so every scenario before The Wrecking Crew looks exactly as it did.
 *
 * `view/villain-tile-layout.ts` decides how the tiles share the rect: as many rows as give the largest scan at a tile
 * no narrower than `VILLAIN_TILE_MIN_WIDTH`, split evenly (six tiles are three and three), every tile inside `rect`.
 * The same "crowd, don't vanish" rule `cardRow` uses for the minions under it.
 */
export function villainRowSlots(rect: Rect, count: number, gap = 8): readonly Rect[] {
  if (count <= 0) return [];
  return villainRowSlotsFor(rect, count, villainRowPlan(rect.width, count, rect.height, rect.height, gap), gap);
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
    /** Where a row narrower than its bounds sits. "start" lets a caller center it together with something else (`view/hand-row.ts`). */
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
  const scale =
    needed <= bounds.width ? 1 : Math.max(0.35, (bounds.width - gap * (count - 1)) / (widthAtFullHeight * count));
  const cardHeight = height * scale;
  const cardWidth = cardHeight * CARD_ASPECT;
  const rowWidth = cardWidth * count + gap * (count - 1);
  // Overlap when even the floor doesn't fit, so the row never leaves the zone.
  const step = rowWidth <= bounds.width ? cardWidth + gap : (bounds.width - cardWidth) / Math.max(1, count - 1);
  const startX =
    rowWidth <= bounds.width && options.align !== "start" ? bounds.x + (bounds.width - rowWidth) / 2 : bounds.x;

  return Array.from({ length: count }, (_unused, index) => ({
    x: startX + step * index,
    y: bounds.y + (bounds.height - cardHeight) / 2,
    width: cardWidth,
    height: cardHeight,
    kind: "full",
  }));
}

/**
 * A row of minion tiles, or, above Fit to screen (`cardScale` > 1), a grid of rows when a single row is limited by the
 * area's width and a grid gives clearly bigger tiles (four minions on a phone: one row is four 80px tiles under a table
 * that scrolls a screen tall). Each row after the first leaves `rowExtra` more than the gap, for the chips that hang
 * above a tile. At Fit to screen it is exactly `cardRow`.
 */
export function minionSlots(
  area: Rect,
  count: number,
  cardScale: number,
  gap: number,
  rowExtra: number,
): readonly CardSlot[] {
  const single = cardRow(area, count, { gap, maxHeight: area.height });
  if (cardScale <= 1 || count < 2 || single.length === 0) return single;
  let best: { rows: number; cols: number; height: number } | null = null;
  for (let rows = 2; rows <= Math.min(count, 3); rows++) {
    const cols = Math.ceil(count / rows);
    const slotHeight = (area.height - (rows - 1) * (gap + rowExtra)) / rows;
    const height = Math.min(slotHeight, (area.width - (cols - 1) * gap) / cols / CARD_ASPECT);
    if (height > 0 && (!best || height > best.height)) best = { rows, cols, height };
  }
  if (!best || best.height < single[0]!.height * 1.2) return single;
  const width = best.height * CARD_ASPECT;
  const used = best.rows * best.height + (best.rows - 1) * (gap + rowExtra);
  const top = area.y + (area.height - used) / 2;
  return Array.from({ length: count }, (_unused, index): CardSlot => {
    const row = Math.floor(index / best.cols);
    const inRow = row === best.rows - 1 ? count - best.cols * row : best.cols;
    const rowWidth = inRow * width + (inRow - 1) * gap;
    return {
      x: area.x + (area.width - rowWidth) / 2 + (index - row * best.cols) * (width + gap),
      y: top + row * (best.height + gap + rowExtra),
      width,
      height: best.height,
      kind: "full",
    };
  });
}

/**
 * Card slots for a choice sheet: one row while the cards stay a readable, tappable size, otherwise a grid. A single
 * row of six on a phone overlaps its cards into slivers (QA C9, B-2); a 3x2 grid keeps each one whole and under a
 * thumb. Picks whichever of the row and the grids gives the larger card, so a wide sheet keeps its row.
 */
export function cardChoiceSlots(
  bounds: Rect,
  count: number,
  options: { readonly gap?: number } = {},
): readonly CardSlot[] {
  if (count <= 0) return [];
  const gap = options.gap ?? 6;
  const row = cardRow(bounds, count, { gap });
  const rowWidth = row[0]?.width ?? 0;
  const overlaps = count > 1 && row.length > 1 && row[1]!.x - row[0]!.x < row[0]!.width + gap - 0.5;
  // An overlapped row shows only a sliver of each card, so what a card is worth in a row is the step to the next one
  // (the card's own width counted the hidden part: at seven on a phone it read 40 px against a 30 px sliver, and no
  // grid of whole cards beat it).
  const shown = overlaps ? Math.max(0, row[1]!.x - row[0]!.x - gap) : rowWidth;
  let best: { cols: number; rows: number; width: number } = { cols: count, rows: 1, width: shown };
  if (overlaps) {
    // The row overlaps: look for a grid whose cards are bigger than the row's.
    for (let cols = 1; cols < count; cols++) {
      const rows = Math.ceil(count / cols);
      const width = Math.min(
        (bounds.width - gap * (cols - 1)) / cols,
        ((bounds.height - gap * (rows - 1)) / rows) * CARD_ASPECT,
      );
      if (width > best.width + 0.5) best = { cols, rows, width };
    }
  }
  if (best.rows === 1) return row;
  const height = best.width / CARD_ASPECT;
  const gridHeight = height * best.rows + gap * (best.rows - 1);
  const top = bounds.y + (bounds.height - gridHeight) / 2;
  return Array.from({ length: count }, (_unused, index) => {
    const r = Math.floor(index / best.cols);
    const inRow = Math.min(best.cols, count - r * best.cols);
    const rowWidth = best.width * inRow + gap * (inRow - 1);
    const left = bounds.x + (bounds.width - rowWidth) / 2;
    return {
      x: left + (index - r * best.cols) * (best.width + gap),
      y: top + r * (height + gap),
      width: best.width,
      height,
      kind: "full" as const,
    };
  });
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

/** Where one stat badge sits: its starburst's center and its diameter. */
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

/** A badge never grows past this, however wide the panel; past it the number just floats in color. */
export const BADGE_MAX = 46;
const BADGE_GAP = 6;
/** Below this a starburst stops reading as one. Layout shrinks toward it, never past. */
const BADGE_FLOOR = 12;
/** Badges are kept at least this big while the HP plate can still shrink to make room (`statBlockLayout`). */
const BADGE_COMFORT = 30;

/** The gap between neighboring badges of `size`: wider below `BADGE_COMFORT`, where the name ribbon outgrows the burst. */
const badgeGap = (size: number): number => BADGE_GAP + Math.max(0, BADGE_COMFORT - size);

/** The ink ribbon carrying a badge's stat name. */
export const ribbonHeight = (size: number): number => Math.max(9, Math.round(size * 0.3));

/** How far a badge reaches above and below its starburst's center, ribbon included. */
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
  const stacked = stackedStatBlock(rect, count, withHp);
  // A short column squeezes the stacked block's badges toward the floor (a hero with a status row and attachments, a
  // villain with a TOUGH tag): put the HP plate beside the badges instead and give them the whole height.
  if (count > 0 && withHp && (stacked.badges[0]?.size ?? 0) < BADGE_COMFORT) {
    const inline = inlineStatBlock(rect, count);
    if (inline && (inline.badges[0]?.size ?? 0) > (stacked.badges[0]?.size ?? 0)) return inline;
  }
  return stacked;
}

/** The narrowest an HP plate beside the badges may be and still read "HP 10/10" at a glance. */
export const INLINE_HP_MIN_WIDTH = 72;

/**
 * Badges in a row with the HP plate to their right, bottom-aligned in `rect`. Null when no badge size above the
 * floor fits both the height and the width the plate needs.
 */
function inlineStatBlock(rect: Rect, count: number): StatBlock | null {
  const rowWidthAt = (candidate: number): number => count * candidate + badgeGap(candidate) * Math.max(0, count - 1);
  const heightAt = (candidate: number): number => {
    const { above, below } = badgeExtent(candidate);
    return Math.ceil(above + below);
  };
  let size = BADGE_COMFORT + 8;
  while (
    size > BADGE_FLOOR &&
    (heightAt(size) > rect.height || rowWidthAt(size) + BADGE_GAP + INLINE_HP_MIN_WIDTH > rect.width)
  )
    size -= 1;
  if (heightAt(size) > rect.height || rowWidthAt(size) + BADGE_GAP + INLINE_HP_MIN_WIDTH > rect.width) return null;
  const { above } = badgeExtent(size);
  const rowHeight = heightAt(size);
  const top = rect.y + rect.height - rowHeight;
  const gap = badgeGap(size);
  const rowWidth = rowWidthAt(size);
  const hpHeight = Math.min(rowHeight, Math.max(24, Math.min(36, Math.round(size * 1.05))));
  const hpX = rect.x + rowWidth + BADGE_GAP + 2;
  const badges = Array.from({ length: count }, (_unused, index) => ({
    cx: rect.x + size / 2 + index * (size + gap),
    cy: top + above,
    size,
  }));
  const hp = { x: hpX, y: top + rowHeight - hpHeight, width: rect.x + rect.width - hpX, height: hpHeight };
  return { badges, hp, height: rowHeight, top };
}

function stackedStatBlock(rect: Rect, count: number, withHp: boolean): StatBlock {
  const roomyHp = withHp ? Math.max(24, Math.min(38, Math.round(rect.width * 0.26))) : 0;
  const widthLimited =
    count > 0
      ? Math.max(BADGE_FLOOR, Math.min(BADGE_MAX, Math.floor((rect.width - BADGE_GAP * (count - 1)) / count)))
      : 0;
  const requiredHeight = (candidate: number, hp: number): number => {
    if (count === 0) return hp;
    const { above, below } = badgeExtent(candidate);
    return Math.ceil(above + below) + (withHp ? BADGE_GAP : 0) + hp;
  };
  // The HP plate gives up height before the badges do: a plate 24px tall still reads, while badges squeezed under
  // ~30px ran their "ATK" and "SCH" ribbons into one word and left no room for a +1 chip beside the number.
  const comfort = Math.min(widthLimited, BADGE_COMFORT);
  const hpHeight = requiredHeight(comfort, roomyHp) <= rect.height ? roomyHp : withHp ? 24 : 0;
  let size = widthLimited;
  // A small badge's ribbon is as wide as the stat's name, not as its starburst, so the gap between small badges
  // opens up enough to keep "ATK" and "SCH" two words.
  const rowWidthAt = (candidate: number): number => count * candidate + badgeGap(candidate) * Math.max(0, count - 1);
  while (size > BADGE_FLOOR && (requiredHeight(size, hpHeight) > rect.height || rowWidthAt(size) > rect.width))
    size -= 1;
  const gap = badgeGap(size);
  const { above, below } = badgeExtent(size);
  const rowHeight = count > 0 ? Math.ceil(above + below) : 0;
  const hpGap = withHp && count > 0 ? BADGE_GAP : 0;
  const height = rowHeight + hpGap + hpHeight;
  // Clamped at `rect.y`: past the floor there is nothing left to shrink, and
  // the block staying inside `rect` at least keeps it off whatever is above `rect` entirely.
  const top = Math.max(rect.y, rect.y + rect.height - height);
  const rowWidth = rowWidthAt(size);
  const startX = rect.x + (rect.width - rowWidth) / 2;
  const badges = Array.from({ length: count }, (_unused, index) => ({
    cx: startX + size / 2 + index * (size + gap),
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
  // 20px is the least that holds "HP 5/6" at the plate's own type; a card under 100px tall can't spare it.
  const hpFloor = inner.height >= 100 ? 20 : 14;
  const hpHeight = withHp ? Math.max(hpFloor, Math.min(28, Math.round(inner.height * 0.13))) : 0;
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
