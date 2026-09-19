/**
 * The Inspect overlay's own layout (docs/phase4-screen-gaps.md §3 "W8"; D08,
 * P14, and T06 for how Inspect sits beside Targeting on tablet — owner
 * feedback 2026-09-18: "The inspect screen looks better in the screenshots
 * with more info showing" and "tablet could look like this too probably").
 *
 * **Two shapes, chosen by form factor alone — not by width threshold.**
 * D08's centered pair of equal-height panels (a paper card beside an ink
 * "Rules & state" panel) is the desktop **and tablet** shape, both
 * orientations; only a true phone (`formFactorFor` < 768px wide) gets P14's
 * bottom sheet. The previous build used `width < 900` as its own narrow
 * cutoff, which put tablet portrait (768×1024) through the phone's stacked
 * sheet — the very gap the owner's feedback names. `inspectLayout` fixes
 * that: `mode` is `"panels"` for every non-phone form factor, `"sheet"` only
 * for phone.
 *
 * **Panels mode.** Centered over the scrim, matching D08's own numbers: the
 * card panel caps at 400px wide, the rules panel at 440px, a 26px gap
 * between them, both the same height, with a bottom-centered hint row below
 * the pair. At narrower tablet widths the two panels shrink together
 * (47%/53% split) rather than overflowing; at very wide desktops they hold
 * their caps and center with more margin, exactly as D08's own `padding: 0
 * 70px` does at 1440px.
 *
 * **Sheet mode.** P14's bottom sheet: a grab handle, a scrolling content
 * region, and a sticky ink footer of two rows (the primary Play/Pay row,
 * then the quiet Full rules text/Close row). `expanded` (the "Full rules
 * text" toggle) grows the sheet to the full viewport height, per the design's
 * own instruction that it "expands the sheet to full height with the
 * complete scrolling text".
 *
 * `cardFaceLayout` is the second half: the paper card panel's own internal
 * split between its art and its scrolling rules text, ported from what used
 * to be computed with a throwaway offscreen Phaser `Text` object
 * (`scenes/inspect.ts`'s old `#drawCard`) into a pure function over an
 * `estimateWrappedLines` line count, so the "long rules text" case is
 * testable without a canvas.
 */

import { estimateWrappedLines, formFactorFor, type Rect } from "./layout.js";

export interface InspectPanelsLayout {
  readonly mode: "panels";
  readonly card: Rect;
  readonly rules: Rect;
  readonly hint: Rect;
}

export interface InspectSheetLayout {
  readonly mode: "sheet";
  readonly sheet: Rect;
  readonly handle: Rect;
  /** The scrolling body: thumbnail/name/type/chips/rules text, the keywords box, "this game" rows. */
  readonly content: Rect;
  /** The sticky ink footer: the primary Play/Pay row, then the quiet Full rules text/Close row. */
  readonly footer: Rect;
  readonly footerPrimaryRow: Rect;
  readonly footerQuietRow: Rect;
}

export type InspectLayout = InspectPanelsLayout | InspectSheetLayout;

const CARD_MAX_WIDTH = 400;
const RULES_MAX_WIDTH = 440;
const PANEL_GAP = 26;
const HINT_HEIGHT = 24;
const PANEL_MIN_HEIGHT = 320;
const PANEL_MAX_HEIGHT = 660;

const SHEET_HANDLE_HEIGHT = 18;
const SHEET_FOOTER_PRIMARY_HEIGHT = 48;
const SHEET_FOOTER_QUIET_HEIGHT = 40;
const SHEET_FOOTER_GAP = 7;
const SHEET_FOOTER_PAD_TOP = 9;
const SHEET_FOOTER_PAD_BOTTOM = 13;
/** How much of the viewport the collapsed sheet covers — P14's own sheet top sits at roughly 78% down a 844px-tall phone. */
const SHEET_COLLAPSED_FRACTION = 0.78;

export interface InspectLayoutOptions {
  /** Phone only: "Full rules text" was tapped, so the sheet grows to cover the whole viewport. */
  readonly expanded?: boolean;
}

export function inspectLayout(viewport: Rect, opts: InspectLayoutOptions = {}): InspectLayout {
  const formFactor = formFactorFor(viewport.width, viewport.height);
  if (formFactor === "phone") return sheetLayout(viewport, opts.expanded ?? false);
  return panelsLayout(viewport);
}

function panelsLayout(viewport: Rect): InspectPanelsLayout {
  const pad = clamp(viewport.width * 0.03, 24, 70);
  const gap = clamp(viewport.width * 0.018, 10, PANEL_GAP);
  const totalWidth = Math.max(0, viewport.width - pad * 2);
  const cardWidth = Math.min(CARD_MAX_WIDTH, totalWidth * 0.47);
  const rulesWidth = Math.max(0, Math.min(RULES_MAX_WIDTH, totalWidth - gap - cardWidth));
  const groupWidth = cardWidth + gap + rulesWidth;

  const height = Math.max(0, viewport.height - pad * 2 - HINT_HEIGHT);
  const panelHeight = clamp(height, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT);

  const groupX = viewport.x + (viewport.width - groupWidth) / 2;
  const groupY = viewport.y + Math.max(pad / 2, (viewport.height - HINT_HEIGHT - panelHeight) / 2);

  const card: Rect = { x: groupX, y: groupY, width: cardWidth, height: panelHeight };
  const rules: Rect = { x: groupX + cardWidth + gap, y: groupY, width: rulesWidth, height: panelHeight };
  const hint: Rect = { x: viewport.x, y: viewport.y + viewport.height - HINT_HEIGHT, width: viewport.width, height: HINT_HEIGHT };
  return { mode: "panels", card, rules, hint };
}

function sheetLayout(viewport: Rect, expanded: boolean): InspectSheetLayout {
  const sheetHeight = expanded ? viewport.height : Math.round(viewport.height * SHEET_COLLAPSED_FRACTION);
  const sheet: Rect = { x: viewport.x, y: viewport.y + viewport.height - sheetHeight, width: viewport.width, height: sheetHeight };
  const handle: Rect = { x: sheet.x, y: sheet.y, width: sheet.width, height: SHEET_HANDLE_HEIGHT };

  const footerHeight = SHEET_FOOTER_PAD_TOP + SHEET_FOOTER_PRIMARY_HEIGHT + SHEET_FOOTER_GAP + SHEET_FOOTER_QUIET_HEIGHT + SHEET_FOOTER_PAD_BOTTOM;
  const footer: Rect = { x: sheet.x, y: sheet.y + sheet.height - footerHeight, width: sheet.width, height: footerHeight };
  const footerPrimaryRow: Rect = { x: footer.x + 12, y: footer.y + SHEET_FOOTER_PAD_TOP, width: footer.width - 24, height: SHEET_FOOTER_PRIMARY_HEIGHT };
  const footerQuietRow: Rect = {
    x: footer.x + 12,
    y: footerPrimaryRow.y + footerPrimaryRow.height + SHEET_FOOTER_GAP,
    width: footer.width - 24,
    height: SHEET_FOOTER_QUIET_HEIGHT,
  };

  const content: Rect = {
    x: sheet.x,
    y: sheet.y + handle.height,
    width: sheet.width,
    height: Math.max(0, footer.y - (sheet.y + handle.height)),
  };
  return { mode: "sheet", sheet, handle, content, footer, footerPrimaryRow, footerQuietRow };
}

/** Every rect a layout places, for a no-overlap test — `panelsLayout`'s hint row is deliberately excluded from the pair, since it sits centered *under* them, not beside them. */
export function inspectLayoutRects(layout: InspectLayout): readonly Rect[] {
  if (layout.mode === "panels") return [layout.card, layout.rules];
  return [layout.handle, layout.content, layout.footerPrimaryRow, layout.footerQuietRow];
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------
// The card panel's own internal split (D08's paper card): header, art, the
// scrolling rules-text region, an optional stat line, resource pips, footer.
// ---------------------------------------------------------------------------

export interface CardFaceLayout {
  readonly header: Rect;
  readonly headerRule: Rect;
  /** Null when there is no room left for art at all (an extremely short panel). */
  readonly art: Rect | null;
  readonly artRule: Rect | null;
  readonly stats: Rect | null;
  readonly scroll: Rect;
  readonly icons: Rect | null;
  readonly footerRule: Rect;
  readonly footer: Rect;
}

export interface CardFaceContent {
  /** From `estimateWrappedLines(model.rulesText + printed + flavor, bodyWidth, CHAR_WIDTH)` — the scene's job, since only it knows the live wrap width and font metrics. */
  readonly rulesTextLines: number;
  readonly hasStats: boolean;
  readonly hasIcons: boolean;
}

const HEADER_HEIGHT = 62;
const FOOTER_HEIGHT = 28;
const RULE_WEIGHT = 4;
const STATS_HEIGHT = 30;
const ICONS_HEIGHT = 30;
/** Matches `typeRole.body`'s 11px/1.45 line height, the role the rules-text scroll panel draws with. */
const BODY_LINE_HEIGHT = 16;

/**
 * The scan gets the room, and the text fits around it — the opposite of the
 * table, where text leads (`scenes/inspect.ts`'s own header comment, carried
 * over verbatim from the pre-rebuild file). Whatever the text needs is
 * estimated first, but the art keeps a floor of just over half the panel so a
 * short "deal 3 damage" card never shrinks its own picture down to nothing.
 */
export function cardFaceLayout(rect: Rect, content: CardFaceContent): CardFaceLayout {
  const header: Rect = { x: rect.x, y: rect.y, width: rect.width, height: HEADER_HEIGHT };
  const headerRule: Rect = { x: rect.x + 5, y: rect.y + HEADER_HEIGHT, width: rect.width - 10, height: RULE_WEIGHT };

  const footer: Rect = { x: rect.x, y: rect.y + rect.height - FOOTER_HEIGHT, width: rect.width, height: FOOTER_HEIGHT };
  const footerRule: Rect = { x: rect.x + 5, y: footer.y, width: rect.width - 10, height: RULE_WEIGHT };

  const artTop = rect.y + HEADER_HEIGHT + RULE_WEIGHT;
  const available = Math.max(0, footer.y - artTop);
  const textHeight = content.rulesTextLines * BODY_LINE_HEIGHT + (content.hasStats ? STATS_HEIGHT : 0) + (content.hasIcons ? ICONS_HEIGHT : 0) + 24;
  const artHeight = Math.max(Math.min(available * 0.52, available), Math.min(available * 0.78, available - textHeight - 20));

  const art: Rect | null = artHeight > 40 ? { x: rect.x + 5, y: artTop, width: rect.width - 10, height: artHeight } : null;
  const artRule: Rect | null = art ? { x: art.x, y: art.y + art.height, width: art.width, height: RULE_WEIGHT } : null;

  let y = (art ? art.y + art.height + RULE_WEIGHT : artTop) + 12;
  const stats: Rect | null = content.hasStats ? { x: rect.x + 14, y, width: rect.width - 28, height: STATS_HEIGHT } : null;
  if (stats) y += STATS_HEIGHT;

  const iconsTop = footer.y - (content.hasIcons ? ICONS_HEIGHT : 0) - 6;
  const icons: Rect | null = content.hasIcons ? { x: rect.x + 14, y: iconsTop, width: rect.width - 28, height: ICONS_HEIGHT } : null;

  const scroll: Rect = { x: rect.x + 10, y, width: rect.width - 20, height: Math.max(0, iconsTop - y) };

  return { header, headerRule, art, artRule, stats, scroll, icons, footerRule, footer };
}
