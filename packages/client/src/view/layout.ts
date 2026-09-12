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
  formFactor === "phone" ? hit.target + hit.primary : hit.primary + 4;

export function boardLayout(viewport: Rect, options: LayoutOptions): BoardLayout {
  const formFactor = formFactorFor(viewport.width, viewport.height);
  const zones =
    formFactor === "phone"
      ? phoneZones(viewport, options)
      : longTableZones(viewport, formFactor, options);
  return {
    formFactor,
    viewport,
    zones,
    tabbed: formFactor === "phone",
    activeTab: formFactor === "phone" ? (options.activeTab ?? "me") : null,
  };
}

type Zones = Record<ZoneName, Rect | null>;

/**
 * `Board - Phone`: chrome, tab rail, one full-width zone, then the hand and the
 * action bar parked at the thumb. Content scrolls under the bar; the bar never
 * scrolls away and its contents never reorder between screens.
 */
function phoneZones(viewport: Rect, options: LayoutOptions): Zones {
  const gutter = GUTTER.phone;
  const chromeHeight = CHROME_HEIGHT.phone;
  const tabsHeight = hit.target;
  const barHeight = actionBarHeight("phone");
  // Enough for one row of fanned cards plus its "HAND 5 · Deck 28" caption.
  const handHeight = Math.min(168, Math.max(120, Math.round(viewport.height * 0.2)));

  const chrome: Rect = { x: viewport.x, y: viewport.y, width: viewport.width, height: chromeHeight };
  const tabs: Rect = { x: viewport.x, y: chrome.y + chrome.height, width: viewport.width, height: tabsHeight };
  const actionBar: Rect = {
    x: viewport.x,
    y: viewport.y + viewport.height - barHeight,
    width: viewport.width,
    height: barHeight,
  };
  const hand: Rect = { x: viewport.x, y: actionBar.y - handHeight, width: viewport.width, height: handHeight };
  // Every tabbed zone gets the same rectangle: only one is visible at a time.
  const content: Rect = {
    x: viewport.x + gutter,
    y: tabs.y + tabs.height + gutter,
    width: viewport.width - gutter * 2,
    height: hand.y - (tabs.y + tabs.height) - gutter * 2,
  };

  return {
    chrome,
    tabs,
    threat: content,
    enemies: content,
    me: content,
    // On phone the play area lives inside the "Me" tab, under the identity panel.
    playArea: content,
    team: options.playerCount > 1 ? content : null,
    // The encounter deck and discard ride in the Enemies tab's header strip.
    encounter: content,
    log: content,
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

/**
 * Card slots laid across a rect in one row, keeping `CARD_ASPECT` and shrinking
 * to fit rather than overflowing. Used for the hand, the play area and minion
 * rows, so they all crowd the same way.
 */
export function cardRow(
  bounds: Rect,
  count: number,
  options: { readonly gap?: number; readonly maxHeight?: number } = {},
): readonly Rect[] {
  if (count <= 0) return [];
  const gap = options.gap ?? 6;
  const height = Math.min(bounds.height, options.maxHeight ?? bounds.height);
  const widthAtFullHeight = height * CARD_ASPECT;
  const needed = widthAtFullHeight * count + gap * (count - 1);

  // Too wide: shrink the cards until the row fits, down to a readable floor.
  const scale = needed <= bounds.width ? 1 : Math.max(0.35, (bounds.width - gap * (count - 1)) / (widthAtFullHeight * count));
  const cardHeight = height * scale;
  const cardWidth = cardHeight * CARD_ASPECT;
  const rowWidth = cardWidth * count + gap * (count - 1);
  // Overlap when even the floor doesn't fit, so the row never leaves the zone.
  const step = rowWidth <= bounds.width ? cardWidth + gap : (bounds.width - cardWidth) / Math.max(1, count - 1);
  const startX = rowWidth <= bounds.width ? bounds.x + (bounds.width - rowWidth) / 2 : bounds.x;

  return Array.from({ length: count }, (_unused, index) => ({
    x: startX + step * index,
    y: bounds.y + (bounds.height - cardHeight) / 2,
    width: cardWidth,
    height: cardHeight,
  }));
}
