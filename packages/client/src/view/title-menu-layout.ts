/**
 * The Title menu (docs/phase4-screen-gaps.md §3 W2, D01/P01), composition
 * read off `docs/design-renders/ScreensDesktop_00-01.png` and
 * `ScreensPhone_00.png`:
 *
 * - **Tablet/desktop**: the screen splits in two down a thin red rule. The
 *   left ~45% is an **ink** art panel (dot-grid texture, art is a future
 *   drop-in slot — nothing but ground today). The right panel is **paper**:
 *   a small red eyebrow label, the Bangers "MARVEL CHAMPIONS" logo, a black
 *   rule, then the menu stacked full-width inside that panel — Continue (the
 *   one red fill on the screen, when there's a game to pick up), New game,
 *   Decks & Collection, Campaign, Extras (the comics, art and music play has opened), Settings
 *   (dashed/dimmed until W4 lands it). A footer row sits at the paper panel's
 *   own bottom, card-pool coverage on the left and the build version on the
 *   right, one line, split apart rather than stacked.
 * - **Phone**: no split — the whole screen is **ink**, top to bottom. The
 *   logo and menu draw over it directly (white text, light-stroke boxes
 *   instead of paper cards), Continue is still the one red fill, and the
 *   footer is "Settings" on the left / version on the right (Settings is a
 *   menu row on tablet/desktop, but the mock demotes it to a footer link on
 *   phone; this build keeps it a full row at every size for one focus order
 *   to describe, and notes the phone footer's own "Settings" link as a
 *   difference still open).
 *
 * This replaces `view/title-layout.ts`, which laid out the old one-page
 * Title-plus-setup screen before W2 split the setup flow onto its own
 * screens.
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";
import { setupMetrics } from "./setup-metrics.js";
import { GAME_ROW_GAP, GAME_ROW_HEIGHT } from "./games-list-model.js";
import { NOTICE_BAR_HEIGHTS } from "./shadowland-notice.js";

const TITLE_BLOCK_RATIO = 1.35;
/** The red divider's own width, and the left art panel's share of a split screen. */
const DIVIDER_WIDTH = 4;
const ART_PANEL_SHARE = 0.45;
/** The rank badge's plate. */
export const RANK_BADGE_HEIGHT = 58;
/** The one-column (phone) badge: a full-width strip above the footer, one line plus the bar and its caption. */
export const RANK_BADGE_PHONE_HEIGHT = 42;
const RANK_BADGE_PHONE_WIDTH = 124;
const RANK_BADGE_MAX_WIDTH = 300;

/** The "In-progress games" panel (art panel, split screens): its widest, its heading, and the least list it is worth drawing. */
const GAMES_PANEL_MAX_WIDTH = 520;
export const GAMES_PANEL_HEADER = 36;
const GAMES_PANEL_PAD = 12;
const GAMES_PANEL_MIN_ROWS = 3;

/**
 * The update banner. Wide enough, it is one row: two lines of text on the left, the buttons on the right. On a narrow
 * column (a small phone, a portrait tablet's art panel) the buttons would cover the text, so they drop to a row of
 * their own under it. A close button ("not now", remembered for that release) takes the top-right corner either way.
 */
const UPDATE_BANNER_PAD = 8;
const UPDATE_BANNER_MAX_WIDTH = 520;
const UPDATE_BUTTON_WIDTH = 104;
const UPDATE_TEXT_INSET = UPDATE_BANNER_PAD + 4;
/** Room for "UPDATE AVAILABLE" over "Version 0.00.0". */
const UPDATE_TEXT_WIDTH = 116;
/** The close button: a touch-sized square at the banner's top-right (one row) or right end (inline). */
const UPDATE_DISMISS_SIZE = hit.target;
const UPDATE_BANNER_INLINE_WIDTH =
  UPDATE_TEXT_INSET +
  UPDATE_TEXT_WIDTH +
  (UPDATE_BANNER_PAD + UPDATE_BUTTON_WIDTH) * 2 +
  (UPDATE_BANNER_PAD + UPDATE_DISMISS_SIZE) +
  UPDATE_BANNER_PAD;
const UPDATE_BANNER_HEIGHT = hit.target + UPDATE_BANNER_PAD * 2;
// Stacked: the text and the close button on one row, the action buttons on the next.
const UPDATE_BANNER_STACKED_HEIGHT = UPDATE_BANNER_PAD * 3 + UPDATE_DISMISS_SIZE * 2;

const updateBannerHeight = (width: number): number =>
  width >= UPDATE_BANNER_INLINE_WIDTH ? UPDATE_BANNER_HEIGHT : UPDATE_BANNER_STACKED_HEIGHT;

/**
 * How many of the update banner's `actions` buttons fit its box: all of them, except in the one-row banner a short
 * phone gets in compact mode (too narrow for two buttons), which keeps the last (the install button, else the notes).
 */
export function updateBannerActionCount(banner: Rect, actions: number): number {
  return banner.height <= UPDATE_BANNER_HEIGHT && banner.width < UPDATE_BANNER_INLINE_WIDTH
    ? Math.min(actions, 1)
    : actions;
}

export interface UpdateBannerParts {
  /** Where the banner's two lines of text start; they run up to `textWidth`. */
  readonly text: { readonly x: number; readonly y: number };
  readonly textWidth: number;
  /** One button per action, left to right. */
  readonly buttons: readonly Rect[];
  /** The close button: dismisses the banner for this release. */
  readonly dismiss: Rect;
}

/** The inside of the update banner, for `actions` buttons (one or two). */
export function updateBannerParts(banner: Rect, actions: number): UpdateBannerParts {
  const textX = banner.x + UPDATE_TEXT_INSET;
  const buttonY = banner.y + banner.height - UPDATE_BANNER_PAD - hit.target;
  const dismissRight = banner.x + banner.width - UPDATE_BANNER_PAD;
  if (banner.height > UPDATE_BANNER_HEIGHT) {
    // Stacked: the buttons share the full width of their own row.
    const inner = banner.width - UPDATE_BANNER_PAD * 2;
    const width = (inner - UPDATE_BANNER_PAD * (actions - 1)) / actions;
    const buttons = Array.from({ length: actions }, (_, i) => ({
      x: banner.x + UPDATE_BANNER_PAD + i * (width + UPDATE_BANNER_PAD),
      y: buttonY,
      width,
      height: hit.target,
    }));
    return {
      text: { x: textX, y: banner.y + UPDATE_BANNER_PAD + 6 },
      textWidth: banner.width - UPDATE_TEXT_INSET - UPDATE_BANNER_PAD * 2 - UPDATE_DISMISS_SIZE,
      buttons,
      dismiss: {
        x: dismissRight - UPDATE_DISMISS_SIZE,
        y: banner.y + UPDATE_BANNER_PAD,
        width: UPDATE_DISMISS_SIZE,
        height: UPDATE_DISMISS_SIZE,
      },
    };
  }
  const buttons: Rect[] = [];
  const dismiss: Rect = {
    x: dismissRight - UPDATE_DISMISS_SIZE,
    y: buttonY,
    width: UPDATE_DISMISS_SIZE,
    height: UPDATE_DISMISS_SIZE,
  };
  let right = dismiss.x - UPDATE_BANNER_PAD;
  for (let i = 0; i < actions; i++) {
    buttons.unshift({ x: right - UPDATE_BUTTON_WIDTH, y: buttonY, width: UPDATE_BUTTON_WIDTH, height: hit.target });
    right -= UPDATE_BUTTON_WIDTH + UPDATE_BANNER_PAD;
  }
  return { text: { x: textX, y: banner.y + UPDATE_BANNER_PAD + 6 }, textWidth: right - textX, buttons, dismiss };
}

export interface TitleMenuLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly continuable: boolean;
  /** True when a newer release is on offer (`platform/update-check.ts`): reserves the update banner. */
  readonly update?: boolean;
  /** The Civil War box is open: a "Civil War!" row directly under Campaign. */
  readonly civilWar?: boolean;
  /** The desktop app: a "Quit to desktop" row under Settings. */
  readonly quit?: boolean;
  /** How many games the list shows (`shouldShowGamesList` decides whether it is offered at all; 0 draws neither). */
  readonly games?: number;
  /**
   * Temporary (`view/shadowland-notice.ts`): a full-width notice bar across the top of the screen. Everything else is
   * laid out in the height left under it.
   */
  readonly noticeBar?: boolean;
}

export interface TitleMenuLayout {
  readonly split: boolean;
  readonly pad: number;
  /** Null on phone: the whole screen is the ink ground, no separate art panel. */
  readonly artPanel: Rect | null;
  readonly divider: Rect | null;
  /** The paper (or, on phone, ink) panel every row below is positioned inside. */
  readonly menuPanel: Rect;
  readonly left: number;
  readonly column: number;
  readonly titleSize: number;
  /**
   * The "update available" banner, or null with nothing to offer. Split screens draw it at the top of the art panel,
   * where it costs the menu no room; a phone has no art panel, so it heads the column and the menu starts below it.
   */
  readonly updateBanner: Rect | null;
  readonly eyebrow: Rect;
  readonly rule: Rect;
  readonly continueRow: Rect | null;
  /**
   * The "In-progress games" panel: on a split screen, in the art panel under the update banner and above the rank
   * badge, when it has room for at least two rows. Its list (below the heading) is `gamesPanelList`.
   */
  readonly gamesPanel: Rect | null;
  readonly gamesPanelList: Rect | null;
  /** "In-progress games (N)", a menu row that opens the list full screen: a phone, or a split screen too short for the panel. */
  readonly gamesRow: Rect | null;
  readonly newGame: Rect;
  readonly decks: Rect;
  readonly campaign: Rect;
  /** "Civil War!", directly under Campaign; null until the Civil War box is unlocked. */
  readonly civilWar: Rect | null;
  readonly extras: Rect;
  /** "Trophy Room": achievements, rank and lifetime points, right under Extras. */
  readonly trophies: Rect;
  /** "How to play" (guided mode G6c, `docs/guided-mode.md` §4): opens the learning hub. */
  readonly howToPlay: Rect;
  readonly settings: Rect;
  /**
   * The rank badge (docs/achievements.md): a corner plate with the rank, lifetime points and the bar to the next
   * rank; a tap opens the Trophy Room. Split screens put it at the art panel's bottom-left, clear of the menu and of
   * the report and music buttons; a phone puts it right of the logo, just above the rule, where "CHAMPIONS" leaves
   * the column's right end empty.
   */
  readonly rankBadge: Rect;
  /** "Quit to desktop", under Settings; null outside the desktop app. */
  readonly quit: Rect | null;
  readonly footer: Rect;
  /** The temporary notice bar across the top (`noticeBar`), or null. */
  readonly noticeBar: Rect | null;
}

export function titleMenuLayoutRects(layout: TitleMenuLayout): readonly Rect[] {
  return [
    ...(layout.updateBanner ? [layout.updateBanner] : []),
    ...(layout.continueRow ? [layout.continueRow] : []),
    ...(layout.gamesPanel ? [layout.gamesPanel] : []),
    ...(layout.gamesRow ? [layout.gamesRow] : []),
    layout.newGame,
    layout.decks,
    layout.campaign,
    ...(layout.civilWar ? [layout.civilWar] : []),
    layout.extras,
    layout.trophies,
    layout.howToPlay,
    layout.settings,
    layout.rankBadge,
    ...(layout.quit ? [layout.quit] : []),
    layout.footer,
    ...(layout.noticeBar ? [layout.noticeBar] : []),
  ];
}

/** The least a gap or the logo shrinks to when the menu is too tall for the screen; rows keep their touch height. */
const GAP_FLOOR = 4;
const TITLE_SIZE_FLOOR = 28;
/** The last resort for a screen still too short: Continue and New game drop to the plain touch height, the floors drop. */
const COMPACT_GAP_FLOOR = 2;
const COMPACT_TITLE_SIZE_FLOOR = 22;
const GAP_STEP = 2;
const TITLE_STEP = 4;

/**
 * Lays the menu out at the form factor's own spacing; when every row present would not fit above the footer (a 360x740
 * phone, a 1024x768 tablet with Continue, Civil War! and the update banner), tightens the gaps and the logo a step at a
 * time to their floors. Touch targets never shrink.
 */
export function titleMenuLayout(input: TitleMenuLayoutInput): TitleMenuLayout {
  if (input.noticeBar !== true) return titleMenuLayoutUnder(input);
  // The notice bar takes the top strip; the menu is laid out in the rest and moved down under it. On a screen too short
  // for the full bar (a 1024x600 tablet) it slims down rather than push a menu that fits without it off the bottom.
  // A menu that only just fits at its compact floor (a 360x640 phone with Continue, Civil War! and games in progress)
  // has no room for any bar, so it goes without: Settings stays on screen. A menu that overflows anyway keeps the bar.
  const plain = titleMenuLayoutUnder(input);
  if (bottomOf(plain) > input.height) return underNoticeBar(input, NOTICE_BAR_HEIGHTS[0]!);
  for (const inset of NOTICE_BAR_HEIGHTS) {
    const layout = underNoticeBar(input, inset);
    if (bottomOf(layout) <= input.height) return layout;
  }
  return plain;
}

function underNoticeBar(input: TitleMenuLayoutInput, inset: number): TitleMenuLayout {
  const below = titleMenuLayoutUnder({ ...input, height: input.height - inset });
  const shift = (rect: Rect): Rect => ({ ...rect, y: rect.y + inset });
  const shifted = Object.fromEntries(
    Object.entries(below).map(([key, value]) => [key, isRect(value) ? shift(value) : value]),
  ) as unknown as TitleMenuLayout;
  return { ...shifted, noticeBar: { x: 0, y: 0, width: input.width, height: inset } };
}

const bottomOf = (layout: TitleMenuLayout): number =>
  Math.max(...titleMenuLayoutRects(layout).map((rect) => rect.y + rect.height));

/** Top-level `Rect` fields only: a future field holding rects in an array or a nested object would need its own shift. */
const isRect = (value: unknown): value is Rect =>
  typeof value === "object" && value !== null && "x" in value && "y" in value && "width" in value && "height" in value;

function titleMenuLayoutUnder(input: TitleMenuLayoutInput): TitleMenuLayout {
  const { width, height } = input;
  const { gap } = setupMetrics(width, height);
  const tightened = (
    badgeUp: boolean,
    compact = false,
  ): Omit<TitleMenuLayout, "noticeBar"> & { readonly fits: boolean } => {
    const gapFloor = compact ? COMPACT_GAP_FLOOR : GAP_FLOOR;
    const titleFloor = compact ? COMPACT_TITLE_SIZE_FLOOR : TITLE_SIZE_FLOOR;
    let tight = { gap, titleSize: null as number | null };
    let layout = titleMenuLayoutAt(input, tight.gap, tight.titleSize, badgeUp, compact);
    while (!layout.fits && (tight.gap > gapFloor || layout.titleSize > titleFloor)) {
      tight = {
        gap: Math.max(gapFloor, tight.gap - GAP_STEP),
        titleSize: Math.max(titleFloor, layout.titleSize - (tight.gap > gapFloor ? 0 : TITLE_STEP)),
      };
      layout = titleMenuLayoutAt(input, tight.gap, tight.titleSize, badgeUp, compact);
    }
    return layout;
  };
  // A phone puts the rank badge above the footer (owner, 2026-10-20); only when every row at once leaves no room there
  // (a 360x740 phone with Continue, Civil War! and the update banner) does it go back up beside the logo.
  let layout = tightened(false);
  if (!layout.fits && !layout.split) layout = tightened(true);
  if (!layout.fits) {
    // Only taken when it makes everything fit: a menu too tall even so keeps the roomier layout.
    const compact = tightened(!layout.split, true);
    if (compact.fits) layout = compact;
  }
  const { fits: _fits, ...rest } = layout;
  return { ...rest, noticeBar: null };
}

function titleMenuLayoutAt(
  input: TitleMenuLayoutInput,
  gap: number,
  titleOverride: number | null,
  badgeUp: boolean,
  compact = false,
): Omit<TitleMenuLayout, "noticeBar"> & { readonly fits: boolean } {
  const primary = compact ? hit.target : hit.primary;
  const { width, height } = input;
  const { phone, short, pad } = setupMetrics(width, height);
  const split = !phone;

  const artPanel: Rect | null = split ? { x: 0, y: 0, width: Math.round(width * ART_PANEL_SHARE), height } : null;
  const divider: Rect | null = split ? { x: artPanel!.width, y: 0, width: DIVIDER_WIDTH, height } : null;
  const menuPanel: Rect = split
    ? { x: artPanel!.width + DIVIDER_WIDTH, y: 0, width: width - artPanel!.width - DIVIDER_WIDTH, height }
    : { x: 0, y: 0, width, height };

  const column = Math.min(menuPanel.width - pad * 2, 520);
  const left = menuPanel.x + (menuPanel.width - column) / 2;

  const titleSize =
    titleOverride ??
    (phone ? 44 : Math.min(72, Math.round(menuPanel.width / 7), Math.round(height * (short ? 0.075 : 0.1))));

  let updateBanner: Rect | null = null;
  let y = pad + titleSize * 0.6;
  if (input.update === true) {
    if (split) {
      const bannerWidth = Math.min(artPanel!.width - pad * 2, UPDATE_BANNER_MAX_WIDTH);
      updateBanner = { x: pad, y: pad, width: bannerWidth, height: updateBannerHeight(bannerWidth) };
    } else {
      // A short phone (compact) gets the one-row banner with a single button, to keep the menu on screen.
      updateBanner = {
        x: left,
        y: pad,
        width: column,
        height: compact ? UPDATE_BANNER_HEIGHT : updateBannerHeight(column),
      };
      y = pad + updateBanner.height + gap;
    }
  }
  const eyebrow: Rect = { x: left, y, width: column, height: 16 };
  y += 16 + 8;
  const titleBlockHeight = titleSize * TITLE_BLOCK_RATIO * 2;
  y += titleBlockHeight;
  const rule: Rect = { x: left, y, width: column, height: 2 };
  y += 2 + gap;

  let continueRow: Rect | null = null;
  if (input.continuable) {
    continueRow = { x: left, y, width: column, height: primary };
    y += primary + gap;
  }

  // The games list: a panel in the art panel when it fits (between the update banner and the rank badge), else a menu row.
  const gameCount = input.games ?? 0;
  let gamesPanel: Rect | null = null;
  let gamesPanelList: Rect | null = null;
  let gamesRow: Rect | null = null;
  const rankBadgeTop = height - pad - RANK_BADGE_HEIGHT;
  if (gameCount >= 1) {
    if (split) {
      const top = updateBanner ? updateBanner.y + updateBanner.height + pad : pad;
      const bottom = rankBadgeTop - pad;
      const rowsHeight = (rows: number): number => rows * (GAME_ROW_HEIGHT + GAME_ROW_GAP) - GAME_ROW_GAP;
      // Never shorter than three rows, so "Remove this game?" (which replaces the list) always has room.
      const rowsNeeded = Math.max(rowsHeight(gameCount), rowsHeight(GAMES_PANEL_MIN_ROWS));
      const chrome = GAMES_PANEL_HEADER + GAMES_PANEL_PAD * 2;
      const least = chrome + rowsHeight(GAMES_PANEL_MIN_ROWS);
      if (bottom - top >= least) {
        const panelHeight = Math.min(bottom - top, chrome + rowsNeeded);
        const panelWidth = Math.min(artPanel!.width - pad * 2, GAMES_PANEL_MAX_WIDTH);
        gamesPanel = { x: pad, y: bottom - panelHeight, width: panelWidth, height: panelHeight };
        gamesPanelList = {
          x: gamesPanel.x + GAMES_PANEL_PAD,
          y: gamesPanel.y + GAMES_PANEL_PAD + GAMES_PANEL_HEADER,
          width: panelWidth - GAMES_PANEL_PAD * 2,
          height: panelHeight - chrome,
        };
      }
    }
    if (!gamesPanel) {
      gamesRow = { x: left, y, width: column, height: hit.target };
      y += hit.target + gap;
    }
  }

  const newGame: Rect = { x: left, y, width: column, height: primary };
  y += primary + gap;
  const decks: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;
  const campaign: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;
  let civilWar: Rect | null = null;
  if (input.civilWar === true) {
    civilWar = { x: left, y, width: column, height: hit.target };
    y += hit.target + gap;
  }
  const extras: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;
  const trophies: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;
  const howToPlay: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;
  const settings: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;
  let quit: Rect | null = null;
  if (input.quit === true) {
    quit = { x: left, y, width: column, height: hit.target };
    y += hit.target + gap;
  }

  // The rank badge: at the art panel's bottom-left on a split screen; in one column (a phone) it sits at the foot of the
  // menu, just above the footer (cards live, release notes), not up by the title (owner, 2026-10-20).
  const menuBottom = menuPanel.y + menuPanel.height;
  const atFoot = !split && !badgeUp;
  const rankBadgeY = atFoot ? Math.max(y, menuBottom - pad - hit.target - gap - RANK_BADGE_PHONE_HEIGHT) : 0;
  const rankBadge: Rect = split
    ? {
        x: pad,
        y: height - pad - RANK_BADGE_HEIGHT,
        width: Math.min(artPanel!.width - pad * 2, RANK_BADGE_MAX_WIDTH),
        height: RANK_BADGE_HEIGHT,
      }
    : atFoot
      ? { x: left, y: rankBadgeY, width: column, height: RANK_BADGE_PHONE_HEIGHT }
      : {
          x: left + column - RANK_BADGE_PHONE_WIDTH,
          y: rule.y - RANK_BADGE_HEIGHT - 6,
          width: RANK_BADGE_PHONE_WIDTH,
          height: RANK_BADGE_HEIGHT,
        };

  const footerY = !atFoot
    ? Math.max(y, menuBottom - pad - hit.target)
    : Math.max(rankBadgeY + RANK_BADGE_PHONE_HEIGHT + gap, menuBottom - pad - hit.target);
  const fits = footerY + hit.target <= menuBottom;
  const footer: Rect = { x: left, y: footerY, width: column, height: hit.target };

  return {
    fits,
    split,
    pad,
    artPanel,
    divider,
    menuPanel,
    left,
    column,
    titleSize,
    updateBanner,
    eyebrow,
    rule,
    continueRow,
    gamesPanel,
    gamesPanelList,
    gamesRow,
    newGame,
    decks,
    campaign,
    civilWar,
    extras,
    trophies,
    howToPlay,
    settings,
    rankBadge,
    quit,
    footer,
  };
}
