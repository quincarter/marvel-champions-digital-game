/**
 * Settings' own layout (docs/phase4-screen-gaps.md §3 "W4"): an ink title bar ("Settings" + a boxed ✕, matching
 * Pause's own header), a tab rail under it (owner, 2026-10-16: one tab at a time rather than one long scroll), and
 * the active tab's sections (issue #169, `view/settings-sections.ts`) below, each a heading with a rule beside it and
 * its rows stacked under. A section with no title (a tab's only section, already named by its tab) draws no heading.
 *
 * Rows come in four shapes, each sized to fit its own wrapped detail text (`toggleRowHeight`, shared with Pause's
 * inline "Table" column) rather than one fixed height only the shortest description fit:
 * - `toggle`: title, detail and an 84px control on the right (a toggle or an "Open ▸" door).
 * - `segmented`: a segmented control beside the text when there is room, otherwise under it so nothing is cut off.
 * - `tiles`: the detail runs the full width with a row of option tiles under it, stacked at phone width.
 * - `level`: the "Guide level" segment, a fixed two-line-per-cell height.
 *
 * **The whole body is one scroll region (docs/guided-mode.md §4 G2b).** Every heading and row below the fixed header
 * is in content space (`y` measured from the content's own top, `0`), and `bodyViewport` is the one scrollable window
 * onto it, the convention `ui/scroll-region.ts`'s own doc comment states. `slots` lists every heading and row in draw
 * order for the region's `heights`; each heading and item carries its own index into it for `scrollIntoView`.
 */
import { hit } from "../tokens.js";
import { formFactorFor, toggleRowHeight, type Rect } from "./layout.js";
import { overlayPanelLayout } from "./overlay-layout.js";

const HEADER_HEIGHT = 60;
const TABS_HEIGHT = hit.target;
/** Space above and below the tab rail. */
const TABS_GAP = 12;
/** A section heading's band: the label, then its rule at the bottom. */
export const SECTION_HEADING_HEIGHT = 26;
const ROW_GAP = 10;
/** Space between the title bar and the first heading, and under the last row. */
const CONTENT_INSET = 14;
/** Space above every section heading after the first, so each section reads as its own block. */
const SECTION_GAP = 26;
/** The "Guide level" segmented row: a fixed two-line-per-cell height, not sized off wrapped text like the toggle rows. */
export const GUIDE_LEVEL_ROW_HEIGHT = 52;

/** Narrower than this and a row of tiles stacks instead of sitting side by side. */
const STACK_TILES_BELOW = 560;
const TILE_HEIGHT = 52;
const TILE_GAP = 8;
/** A segmented control sits beside its text only when the text keeps at least this much width. */
const SEGMENTED_TEXT_MIN = 260;

export type SettingsItemSpec =
  | { readonly kind: "toggle"; readonly id: string; readonly detail: string }
  | { readonly kind: "segmented"; readonly id: string; readonly detail: string; readonly controlWidth: number }
  | { readonly kind: "tiles"; readonly id: string; readonly detail: string; readonly count: number }
  | { readonly kind: "level"; readonly id: string };

export interface SettingsSectionSpec {
  readonly id: string;
  readonly title: string;
  readonly items: readonly SettingsItemSpec[];
}

/** One placed row, in content space. */
export interface SettingsItemLayout {
  readonly id: string;
  readonly kind: SettingsItemSpec["kind"];
  readonly row: Rect;
  /** A segmented row's control; null for every other shape. */
  readonly control: Rect | null;
  /** A segmented row whose control sits under its text, or a tiles row whose tiles stack. */
  readonly stacked: boolean;
  /** A tiles row's tiles, side by side or stacked; empty for every other shape. */
  readonly tiles: readonly Rect[];
  /** This row's index into `SettingsContentLayout.slots`. */
  readonly slot: number;
}

export interface SettingsSectionLayout {
  readonly id: string;
  readonly title: string;
  /** Null for an untitled section, which draws no heading. */
  readonly heading: Rect | null;
  /** The heading's index into `slots`; -1 with no heading. */
  readonly headingSlot: number;
  readonly items: readonly SettingsItemLayout[];
}

/** Every heading and row this screen draws, in content space (`y` from the body's own top). */
export interface SettingsContentLayout {
  readonly sections: readonly SettingsSectionLayout[];
  /** Every heading and row rect in draw order, for `McScrollRegion`'s `heights` (`contentSlotHeights`). */
  readonly slots: readonly Rect[];
  /** The content's own total height, for the scroll region's clamp. */
  readonly totalHeight: number;
}

export interface SettingsLayout {
  readonly panel: Rect;
  readonly header: Rect;
  /** The tab rail, under the header. */
  readonly tabs: Rect;
  /** The one scroll region under the tab rail — screen space; everything in `content` draws inside it. */
  readonly bodyViewport: Rect;
  readonly content: SettingsContentLayout;
}

export function settingsLayout(bounds: Rect, sections: readonly SettingsSectionSpec[]): SettingsLayout {
  const { panel, header, body } = overlayPanelLayout(bounds, HEADER_HEIGHT, 0);
  const x = body.x + 16;
  const width = Math.max(0, body.width - 32);
  const tabs: Rect = { x, y: body.y + TABS_GAP, width, height: TABS_HEIGHT };
  const bodyTop = tabs.y + tabs.height + TABS_GAP / 2;
  const onDesktop = formFactorFor(bounds.width, bounds.height) === "desktop";

  const slots: Rect[] = [];
  const placed: SettingsSectionLayout[] = [];
  let y = CONTENT_INSET;
  for (const section of sections) {
    if (section.items.length === 0) continue;
    if (placed.length > 0) y += SECTION_GAP;
    const heading: Rect | null = section.title ? { x, y, width, height: SECTION_HEADING_HEIGHT } : null;
    const headingSlot = heading ? slots.push(heading) - 1 : -1;
    if (heading) y += SECTION_HEADING_HEIGHT + 8;
    const items: SettingsItemLayout[] = [];
    for (const spec of section.items) {
      const item = placeItem(spec, x, y, width, onDesktop, slots.length);
      slots.push(item.row);
      items.push(item);
      y = item.row.y + item.row.height + ROW_GAP;
    }
    y -= ROW_GAP;
    placed.push({ id: section.id, title: section.title, heading, headingSlot, items });
  }
  const totalHeight = Math.max(0, y + CONTENT_INSET);

  // Never taller than the content itself (no dead scroll space when it already fits, as on a roomy desktop), and
  // never taller than what's actually left in the panel (the phone case this region exists for).
  const viewportHeight = Math.min(totalHeight, Math.max(0, body.y + body.height - bodyTop));
  const bodyViewport: Rect = { x, y: bodyTop, width, height: viewportHeight };

  return { panel, header, tabs, bodyViewport, content: { sections: placed, slots, totalHeight } };
}

function placeItem(
  spec: SettingsItemSpec,
  x: number,
  y: number,
  width: number,
  onDesktop: boolean,
  slot: number,
): SettingsItemLayout {
  const base = { id: spec.id, kind: spec.kind, control: null, stacked: false, tiles: [] as readonly Rect[], slot };
  switch (spec.kind) {
    case "toggle":
      return { ...base, row: { x, y, width, height: toggleRowHeight(spec.detail, width, onDesktop) } };
    case "level":
      return { ...base, row: { x, y, width, height: GUIDE_LEVEL_ROW_HEIGHT } };
    case "segmented": {
      const beside = width >= spec.controlWidth + SEGMENTED_TEXT_MIN;
      // `toggleRowHeight` reserves 100px for an 84px control: a wider control beside the text takes the rest, and text
      // with the control under it gets the whole width back.
      const textHeight = toggleRowHeight(
        spec.detail,
        beside ? width - (spec.controlWidth - 84) : width + 100,
        onDesktop,
      );
      const height = beside ? Math.max(textHeight, 44) : textHeight + 40;
      const controlWidth = Math.min(spec.controlWidth, width - 4);
      const control: Rect = beside
        ? { x: x + width - controlWidth - 2, y: y + (height - 32) / 2, width: controlWidth, height: 32 }
        : { x: x + 2, y: y + height - 36, width: controlWidth, height: 32 };
      return { ...base, row: { x, y, width, height }, control, stacked: !beside };
    }
    case "tiles": {
      const stacked = width < STACK_TILES_BELOW;
      // The detail runs the full row width (no control beside it), so size it as a toggle row with the control's
      // 100px reservation given back; the tiles then follow it.
      const textHeight = toggleRowHeight(spec.detail, width + 100, onDesktop) - 8;
      const tilesTop = y + textHeight + 4;
      const count = Math.max(1, spec.count);
      const tileWidth = stacked ? width : (width - 2 - TILE_GAP * (count - 1)) / count;
      const tiles: Rect[] = Array.from({ length: count }, (_, i) => ({
        x: stacked ? x : x + i * (tileWidth + TILE_GAP),
        y: stacked ? tilesTop + i * (TILE_HEIGHT + TILE_GAP) : tilesTop,
        width: tileWidth,
        height: TILE_HEIGHT,
      }));
      const bottom = tiles[tiles.length - 1]!.y + TILE_HEIGHT;
      return { ...base, row: { x, y, width, height: bottom - y }, tiles, stacked };
    }
  }
}

/** Every rect this layout places in screen space, for a no-overlap test — the content's own rects are in a separate coordinate space (see `SettingsContentLayout`), so only the one viewport onto them is checked here. */
export function settingsLayoutRects(layout: SettingsLayout): readonly Rect[] {
  return [layout.header, layout.tabs, layout.bodyViewport];
}
