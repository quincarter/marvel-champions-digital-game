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

export interface TitleMenuLayoutInput {
  readonly width: number;
  readonly height: number;
  readonly continuable: boolean;
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
  readonly eyebrow: Rect;
  readonly rule: Rect;
  readonly continueRow: Rect | null;
  readonly newGame: Rect;
  readonly decks: Rect;
  readonly campaign: Rect;
  readonly extras: Rect;
  readonly settings: Rect;
  readonly footer: Rect;
}

export function titleMenuLayoutRects(layout: TitleMenuLayout): readonly Rect[] {
  return [
    ...(layout.continueRow ? [layout.continueRow] : []),
    layout.newGame,
    layout.decks,
    layout.campaign,
    layout.extras,
    layout.settings,
    layout.footer,
  ];
}

export function titleMenuLayout(input: TitleMenuLayoutInput): TitleMenuLayout {
  const { width, height } = input;
  const { phone, short, pad, gap } = setupMetrics(width, height);
  const split = !phone;

  const artPanel: Rect | null = split ? { x: 0, y: 0, width: Math.round(width * ART_PANEL_SHARE), height } : null;
  const divider: Rect | null = split ? { x: artPanel!.width, y: 0, width: DIVIDER_WIDTH, height } : null;
  const menuPanel: Rect = split
    ? { x: artPanel!.width + DIVIDER_WIDTH, y: 0, width: width - artPanel!.width - DIVIDER_WIDTH, height }
    : { x: 0, y: 0, width, height };

  const column = Math.min(menuPanel.width - pad * 2, 520);
  const left = menuPanel.x + (menuPanel.width - column) / 2;

  const titleSize = phone
    ? 44
    : Math.min(72, Math.round(menuPanel.width / 7), Math.round(height * (short ? 0.075 : 0.1)));

  let y = pad + titleSize * 0.6;
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
  const extras: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;
  const settings: Rect = { x: left, y, width: column, height: hit.target };
  y += hit.target + gap;

  const footerY = Math.max(y, menuPanel.y + menuPanel.height - pad - hit.target);
  const footer: Rect = { x: left, y: footerY, width: column, height: hit.target };

  return {
    split,
    pad,
    artPanel,
    divider,
    menuPanel,
    left,
    column,
    titleSize,
    eyebrow,
    rule,
    continueRow,
    newGame,
    decks,
    campaign,
    extras,
    settings,
    footer,
  };
}
