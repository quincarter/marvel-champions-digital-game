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

const TITLE_BLOCK_RATIO = 1.35;
/** The red divider's own width, and the left art panel's share of a split screen. */
const DIVIDER_WIDTH = 4;
const ART_PANEL_SHARE = 0.45;

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
  readonly newGame: Rect;
  readonly decks: Rect;
  readonly campaign: Rect;
  /** "Civil War!", directly under Campaign; null until the Civil War box is unlocked. */
  readonly civilWar: Rect | null;
  readonly extras: Rect;
  /** "How to play" (guided mode G6c, `docs/guided-mode.md` §4): opens the learning hub. */
  readonly howToPlay: Rect;
  readonly settings: Rect;
  readonly footer: Rect;
}

export function titleMenuLayoutRects(layout: TitleMenuLayout): readonly Rect[] {
  return [
    ...(layout.updateBanner ? [layout.updateBanner] : []),
    ...(layout.continueRow ? [layout.continueRow] : []),
    layout.newGame,
    layout.decks,
    layout.campaign,
    ...(layout.civilWar ? [layout.civilWar] : []),
    layout.extras,
    layout.howToPlay,
    layout.settings,
    layout.footer,
  ];
}

/** The least a gap or the logo shrinks to when the menu is too tall for the screen; rows keep their touch height. */
const GAP_FLOOR = 4;
const TITLE_SIZE_FLOOR = 28;
const GAP_STEP = 2;
const TITLE_STEP = 4;

/**
 * Lays the menu out at the form factor's own spacing; when every row present would not fit above the footer (a 360x740
 * phone, a 1024x768 tablet with Continue, Civil War! and the update banner), tightens the gaps and the logo a step at a
 * time to their floors. Touch targets never shrink.
 */
export function titleMenuLayout(input: TitleMenuLayoutInput): TitleMenuLayout {
  const { width, height } = input;
  const { gap } = setupMetrics(width, height);
  let tight = { gap, titleSize: null as number | null };
  let layout = titleMenuLayoutAt(input, tight.gap, tight.titleSize);
  while (!layout.fits && (tight.gap > GAP_FLOOR || layout.titleSize > TITLE_SIZE_FLOOR)) {
    tight = {
      gap: Math.max(GAP_FLOOR, tight.gap - GAP_STEP),
      titleSize: Math.max(TITLE_SIZE_FLOOR, layout.titleSize - (tight.gap > GAP_FLOOR ? 0 : TITLE_STEP)),
    };
    layout = titleMenuLayoutAt(input, tight.gap, tight.titleSize);
  }
  const { fits: _fits, ...rest } = layout;
  return rest;
}

function titleMenuLayoutAt(
  input: TitleMenuLayoutInput,
  gap: number,
  titleOverride: number | null,
): TitleMenuLayout & { readonly fits: boolean } {
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
      updateBanner = { x: left, y: pad, width: column, height: updateBannerHeight(column) };
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
    continueRow = { x: left, y, width: column, height: hit.primary };
    y += hit.primary + gap;
  }

  const newGame: Rect = { x: left, y, width: column, height: hit.primary };
  y += hit.primary + gap;
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
  const howToPlay: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;
  const settings: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;

  const footerY = Math.max(y, menuPanel.y + menuPanel.height - pad - hit.target);
  const fits = footerY + hit.target <= menuPanel.y + menuPanel.height;
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
    newGame,
    decks,
    campaign,
    civilWar,
    extras,
    howToPlay,
    settings,
    footer,
  };
}
