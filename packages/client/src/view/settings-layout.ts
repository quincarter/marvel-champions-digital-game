/**
 * Settings' own layout (docs/phase4-screen-gaps.md §3 "W4"; fidelity pass
 * 2026-09-17): an ink title bar ("Settings" + a boxed ✕, matching Pause's own
 * header) over a "Table" heading and one fixed-height toggle row per setting,
 * stacked — the same row shape Pause's inline "Table" column now uses, so a
 * player who opens either screen reads the identical group. `rowCount` is the
 * number of *real* toggle rows this build draws (reduced motion, sharper text,
 * large card text, sound-drawn-unavailable) — kept a parameter rather than a
 * hardcoded 4 so a later setting doesn't need this module touched to grow.
 *
 * **The whole body is one scroll region (docs/guided-mode.md §4 G2b, fixed
 * 2026-09-26).** Table, Unlocks and Guide used to be two pieces — the Table/
 * Unlocks rows stacked directly into the panel, only the Guide group (below
 * them) in its own bounded, scrollable viewport — so on a real phone height,
 * where the Table group and Unlocks row alone already use most of the panel,
 * the Guide group's own six rows either scrolled in a cramped little box of
 * their own or (found in browser verification, 2026-09-26) ran straight off
 * the bottom of the panel with nothing to scroll them into view. Every row
 * below the fixed header — `tableHeading` through the last Guide row — is now
 * one `content` block in content space (`y` measured from the content's own
 * top, `0`), and `bodyViewport` is the one scrollable window onto it, the
 * same convention `ui/scroll-region.ts`'s own doc comment states. The scene
 * draws every row into one `McScrollRegion` at `bodyViewport`, the way
 * `scenes/table-setup.ts`'s compact layout already does for its own
 * taller-than-the-screen content — never a second, nested scroll box for the
 * Guide group alone, at any width.
 */
import { formFactorFor, toggleRowHeight, type Rect } from "./layout.js";
import { overlayPanelLayout } from "./overlay-layout.js";

const HEADER_HEIGHT = 60;
const HEADING_HEIGHT = 20;
const ROW_GAP = 10;
const GROUP_GAP = 16;
/** The "Guide level" segmented row: a fixed two-line-per-cell height, not sized off wrapped text like the toggle rows. */
export const GUIDE_LEVEL_ROW_HEIGHT = 52;

export interface SettingsLayout {
  readonly panel: Rect;
  readonly header: Rect;
  /** The one scroll region under the fixed header — screen space; everything in `content` draws inside it. */
  readonly bodyViewport: Rect;
  readonly content: SettingsContentLayout;
}

/** The Villain phase group's rects (content space). Each choice row's own title/detail sit in `auto`/`speed`; tiles/segments are laid out below or beside them. */
export interface SettingsVillainLayout {
  readonly heading: Rect;
  /** The whole "Auto-advance" row: title, detail and the tiles. */
  readonly auto: Rect;
  /** One rect per auto-advance tile; side by side, or stacked at phone width. */
  readonly autoTiles: readonly Rect[];
  readonly hold: Rect;
  /** The "Beat speed" row; its three-segment control is `speedControl`, right-aligned inside it. */
  readonly speed: Rect;
  readonly speedControl: Rect;
  readonly dock: Rect;
}

/** The text the Villain phase group's rows size themselves off. */
export interface SettingsVillainDetails {
  readonly auto: string;
  readonly hold: string;
  readonly speed: string;
  readonly dock: string;
}

/** Narrower than this and the three auto-advance tiles stack instead of sitting side by side. */
const STACK_TILES_BELOW = 560;
const TILE_HEIGHT = 52;
const TILE_GAP = 8;
const SPEED_CONTROL_WIDTH = 204;
const CARD_HOVER_CONTROL_WIDTH = 280;
const CARD_SIZE_CONTROL_WIDTH = 252;

/** Every row this screen draws, in content space (`y` from the body's own top) — see this file's own doc comment. */
export interface SettingsContentLayout {
  readonly tableHeading: Rect;
  /** One rect per Table toggle row, then one more for the Unlocks row at the end — `rowDetails`'s own order. */
  readonly rows: readonly Rect[];
  /** The Villain phase group, between the Table rows and Guide; absent when `settingsLayout` was given no villain details. */
  readonly villain: SettingsVillainLayout | null;
  /** The "Card size on hover" row and its five-segment control, after the Table rows; null when not given a detail or off desktop (no mouse popover elsewhere). */
  readonly cardHover: { readonly row: Rect; readonly control: Rect } | null;
  /** The global "Card size" row and its three-segment control, after the hover row; null when not given a detail. On a narrow screen the control drops under the text. */
  readonly cardSize: { readonly row: Rect; readonly control: Rect } | null;
  readonly guideHeading: Rect;
  readonly guideLevelRow: Rect;
  /** One rect per Guide row after the level row: "Play the tutorial", "Aspect lessons", then one per warning toggle. */
  readonly guideRows: readonly Rect[];
  /** The content's own total height, for `McScrollRegion`'s `heights` (`view/layout.ts`'s `contentSlotHeights`) and its clamp. */
  readonly totalHeight: number;
}

/**
 * `rowDetails[i]` is that row's own rendered detail text (`row.unavailable ??
 * row.detail`, plus the Unlocks row's own summary line at the end) — each row
 * is sized to fit it (`toggleRowHeight`, shared with Pause's inline "Table"
 * column, `view/pause-layout.ts`) rather than every row sharing one fixed
 * height that only the *shortest* description actually fit. Fidelity pass,
 * 2026-09-17: at phone width "Reduced motion"'s three-line detail used to run
 * into "Sharper text"'s own heading below it.
 *
 * `guideRowDetails[i]` is the Guide group's own row-after-the-level-row detail text (`row.unavailable ??
 * row.detail`), in draw order: "Play the tutorial", "Aspect lessons", then one per warning toggle
 * (`guideRowInfoOf` minus its own `"guide-level"` entry) — sized the same way `rowDetails` is.
 */
export function settingsLayout(
  bounds: Rect,
  rowDetails: readonly string[],
  guideRowDetails: readonly string[] = [],
  villainDetails?: SettingsVillainDetails,
  cardHoverDetail?: string,
  cardSizeDetail?: string,
): SettingsLayout {
  const { panel, header, body } = overlayPanelLayout(bounds, HEADER_HEIGHT, 0);
  const contentX = body.x + 16;
  const contentWidth = Math.max(0, body.width - 32);
  const onDesktop = formFactorFor(bounds.width, bounds.height) === "desktop";

  // Content space: everything below starts at its own y=0, translated into the viewport by the scroll region.
  const tableHeading: Rect = { x: contentX, y: 0, width: contentWidth, height: HEADING_HEIGHT };
  const rowsTop = tableHeading.y + tableHeading.height + 6;
  const rows: Rect[] = [];
  let y = rowsTop;
  for (const detail of rowDetails) {
    const height = toggleRowHeight(detail, contentWidth, onDesktop);
    rows.push({ x: contentX, y, width: contentWidth, height });
    y += height + ROW_GAP;
  }
  const rowsBottom = rows.length > 0 ? rows[rows.length - 1]!.y + rows[rows.length - 1]!.height : rowsTop;

  let cardHover: SettingsContentLayout["cardHover"] = null;
  let tableBottom = rowsBottom;
  if (cardHoverDetail !== undefined && onDesktop) {
    const height = Math.max(
      toggleRowHeight(cardHoverDetail, contentWidth - (CARD_HOVER_CONTROL_WIDTH - 84), onDesktop),
      44,
    );
    const row: Rect = { x: contentX, y: rowsBottom + ROW_GAP, width: contentWidth, height };
    cardHover = {
      row,
      control: {
        x: row.x + row.width - CARD_HOVER_CONTROL_WIDTH - 2,
        y: row.y + (row.height - 32) / 2,
        width: CARD_HOVER_CONTROL_WIDTH,
        height: 32,
      },
    };
    tableBottom = row.y + row.height;
  }

  let cardSize: SettingsContentLayout["cardSize"] = null;
  if (cardSizeDetail !== undefined) {
    // Side by side when the text still has room; otherwise the control sits under the text so nothing is cut off.
    const beside = contentWidth >= CARD_SIZE_CONTROL_WIDTH + 260;
    const textHeight = toggleRowHeight(
      cardSizeDetail,
      beside ? contentWidth - (CARD_SIZE_CONTROL_WIDTH - 84) : contentWidth,
      onDesktop,
    );
    const height = beside ? Math.max(textHeight, 44) : textHeight + 40;
    const row: Rect = { x: contentX, y: tableBottom + ROW_GAP, width: contentWidth, height };
    const controlWidth = Math.min(CARD_SIZE_CONTROL_WIDTH, contentWidth - 4);
    cardSize = {
      row,
      control: beside
        ? { x: row.x + row.width - controlWidth - 2, y: row.y + (row.height - 32) / 2, width: controlWidth, height: 32 }
        : { x: row.x + 2, y: row.y + row.height - 36, width: controlWidth, height: 32 },
    };
    tableBottom = row.y + row.height;
  }

  let villain: SettingsVillainLayout | null = null;
  let afterRowsBottom = tableBottom;
  if (villainDetails) {
    const heading: Rect = { x: contentX, y: tableBottom + GROUP_GAP, width: contentWidth, height: HEADING_HEIGHT };
    const autoTop = heading.y + heading.height + 6;
    const stacked = contentWidth < STACK_TILES_BELOW;
    // The auto-advance detail runs the full row width (no control beside it), so size it as a toggle row with the
    // control's 100px reservation given back; its tiles then follow it.
    const autoTextHeight = toggleRowHeight(villainDetails.auto, contentWidth + 100, onDesktop) - 8;
    const tilesTop = autoTop + autoTextHeight + 4;
    const tileWidth = stacked ? contentWidth : (contentWidth - 2 - TILE_GAP * 2) / 3;
    const autoTiles: Rect[] = [0, 1, 2].map((i) => ({
      x: stacked ? contentX : contentX + i * (tileWidth + TILE_GAP),
      y: stacked ? tilesTop + i * (TILE_HEIGHT + TILE_GAP) : tilesTop,
      width: tileWidth,
      height: TILE_HEIGHT,
    }));
    const autoBottom = autoTiles[2]!.y + TILE_HEIGHT;
    const auto: Rect = { x: contentX, y: autoTop, width: contentWidth, height: autoBottom - autoTop };
    const holdRowTop = autoBottom + ROW_GAP;
    const hold: Rect = {
      x: contentX,
      y: holdRowTop,
      width: contentWidth,
      height: toggleRowHeight(villainDetails.hold, contentWidth, onDesktop),
    };
    // The speed control is wider than a toggle, so its row reserves that width for its detail text instead.
    const speedHeight = Math.max(
      toggleRowHeight(villainDetails.speed, contentWidth - (SPEED_CONTROL_WIDTH - 84), onDesktop),
      44,
    );
    const speed: Rect = { x: contentX, y: hold.y + hold.height + ROW_GAP, width: contentWidth, height: speedHeight };
    const speedControl: Rect = {
      x: speed.x + speed.width - SPEED_CONTROL_WIDTH - 2,
      y: speed.y + (speed.height - 32) / 2,
      width: SPEED_CONTROL_WIDTH,
      height: 32,
    };
    const dock: Rect = {
      x: contentX,
      y: speed.y + speed.height + ROW_GAP,
      width: contentWidth,
      height: toggleRowHeight(villainDetails.dock, contentWidth, onDesktop),
    };
    villain = { heading, auto, autoTiles, hold, speed, speedControl, dock };
    afterRowsBottom = dock.y + dock.height;
  }

  const guideHeading: Rect = {
    x: contentX,
    y: afterRowsBottom + GROUP_GAP,
    width: contentWidth,
    height: HEADING_HEIGHT,
  };
  const guideLevelRow: Rect = {
    x: contentX,
    y: guideHeading.y + guideHeading.height + 6,
    width: contentWidth,
    height: GUIDE_LEVEL_ROW_HEIGHT,
  };
  const guideRows: Rect[] = [];
  let gy = guideLevelRow.y + guideLevelRow.height + ROW_GAP;
  for (const detail of guideRowDetails) {
    const height = toggleRowHeight(detail, contentWidth, onDesktop);
    guideRows.push({ x: contentX, y: gy, width: contentWidth, height });
    gy += height + ROW_GAP;
  }
  const totalHeight = Math.max(0, gy - ROW_GAP);

  const viewportTop = body.y;
  // Never taller than the content itself (no dead scroll space when it already fits, as on a roomy desktop), and
  // never taller than what's actually left in the panel (the phone case this group exists for).
  const available = Math.max(0, body.y + body.height - viewportTop);
  const viewportHeight = Math.min(totalHeight, available);
  const bodyViewport: Rect = { x: contentX, y: viewportTop, width: contentWidth, height: viewportHeight };

  return {
    panel,
    header,
    bodyViewport,
    content: { tableHeading, rows, villain, cardHover, cardSize, guideHeading, guideLevelRow, guideRows, totalHeight },
  };
}

/** Every rect this layout places, for a no-overlap test — the content's own rects are in a separate coordinate space (see `SettingsContentLayout`), so only the one viewport onto them is checked here. */
export function settingsLayoutRects(layout: SettingsLayout): readonly Rect[] {
  return [layout.header, layout.bodyViewport];
}
