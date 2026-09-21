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
 * **The pair is content-sized, not viewport-stretched** (owner feedback,
 * 2026-09-21: the ink "Rules & state" panel was reading as mostly empty with
 * a bare scrollbar track in it). The panel height is `max(card panel's own
 * content height, rules panel's own content height)`, clamped to the
 * viewport minus padding, then the pair is vertically centered — the same
 * shape D08 draws for its one worked example, where both panels happen to
 * come out equal. Neither pure function in here measures text: both take
 * pre-measured numbers (`cardFaceContentHeight`'s own `CardFaceContent`,
 * mirroring `cardFaceLayout`'s), the same "the scene measures, this file only
 * lays out" contract `cardFaceLayout` already kept for `rulesTextLines`. The
 * rules panel's own content height has no pure counterpart here — its
 * sections (right now / timing / keywords / traits / history) are the
 * scene's own bespoke draw, not `inspect-layout.ts`'s concern — so
 * `scenes/inspect.ts#rebuild` calls `inspectLayout` twice: once to learn each
 * panel's *width* (content-independent), then again, after measuring both
 * panels' natural content height at that width, to get the final centered
 * rect pair.
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

import { formFactorFor, type Rect } from "./layout.js";

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
/** The floor under both panels' height — mostly a guard against a degenerate near-zero viewport; real content almost always exceeds it. */
const PANEL_MIN_HEIGHT = 320;

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
  /**
   * Panels only: each panel's own natural (unclamped) content height in px — the scene's own measurement, passed in
   * rather than measured here (this file's own header comment). Defaults to `PANEL_MIN_HEIGHT`, which is what a
   * caller gets on the first of `scenes/inspect.ts#rebuild`'s two `inspectLayout` calls, made before either panel's
   * content has been measured, purely to learn the panels' own (content-independent) width.
   */
  readonly cardContentHeight?: number;
  readonly rulesContentHeight?: number;
}

export function inspectLayout(viewport: Rect, opts: InspectLayoutOptions = {}): InspectLayout {
  const formFactor = formFactorFor(viewport.width, viewport.height);
  if (formFactor === "phone") return sheetLayout(viewport, opts.expanded ?? false);
  return panelsLayout(
    viewport,
    opts.cardContentHeight ?? PANEL_MIN_HEIGHT,
    opts.rulesContentHeight ?? PANEL_MIN_HEIGHT,
  );
}

function panelsLayout(viewport: Rect, cardContentHeight: number, rulesContentHeight: number): InspectPanelsLayout {
  const pad = clamp(viewport.width * 0.03, 24, 70);
  const gap = clamp(viewport.width * 0.018, 10, PANEL_GAP);
  const totalWidth = Math.max(0, viewport.width - pad * 2);
  const cardWidth = Math.min(CARD_MAX_WIDTH, totalWidth * 0.47);
  const rulesWidth = Math.max(0, Math.min(RULES_MAX_WIDTH, totalWidth - gap - cardWidth));
  const groupWidth = cardWidth + gap + rulesWidth;

  // "The pair's height = max(card content height, rules content height), clamped to the viewport minus padding" —
  // this file's own header comment. `maxHeight` itself never drops below `PANEL_MIN_HEIGHT`, so a very short
  // viewport degrades to that floor rather than to something smaller still.
  const maxHeight = Math.max(PANEL_MIN_HEIGHT, viewport.height - pad * 2 - HINT_HEIGHT);
  const natural = Math.max(PANEL_MIN_HEIGHT, cardContentHeight, rulesContentHeight);
  const panelHeight = Math.min(natural, maxHeight);

  const groupX = viewport.x + (viewport.width - groupWidth) / 2;
  const groupY = viewport.y + Math.max(0, (viewport.height - HINT_HEIGHT - panelHeight) / 2);

  const card: Rect = { x: groupX, y: groupY, width: cardWidth, height: panelHeight };
  const rules: Rect = { x: groupX + cardWidth + gap, y: groupY, width: rulesWidth, height: panelHeight };
  const hint: Rect = {
    x: viewport.x,
    y: viewport.y + viewport.height - HINT_HEIGHT,
    width: viewport.width,
    height: HINT_HEIGHT,
  };
  return { mode: "panels", card, rules, hint };
}

function sheetLayout(viewport: Rect, expanded: boolean): InspectSheetLayout {
  const sheetHeight = expanded ? viewport.height : Math.round(viewport.height * SHEET_COLLAPSED_FRACTION);
  const sheet: Rect = {
    x: viewport.x,
    y: viewport.y + viewport.height - sheetHeight,
    width: viewport.width,
    height: sheetHeight,
  };
  const handle: Rect = { x: sheet.x, y: sheet.y, width: sheet.width, height: SHEET_HANDLE_HEIGHT };

  const footerHeight =
    SHEET_FOOTER_PAD_TOP +
    SHEET_FOOTER_PRIMARY_HEIGHT +
    SHEET_FOOTER_GAP +
    SHEET_FOOTER_QUIET_HEIGHT +
    SHEET_FOOTER_PAD_BOTTOM;
  const footer: Rect = {
    x: sheet.x,
    y: sheet.y + sheet.height - footerHeight,
    width: sheet.width,
    height: footerHeight,
  };
  const footerPrimaryRow: Rect = {
    x: footer.x + 12,
    y: footer.y + SHEET_FOOTER_PAD_TOP,
    width: footer.width - 24,
    height: SHEET_FOOTER_PRIMARY_HEIGHT,
  };
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
// The card panel's own internal split (D08's paper card): header, a
// fixed-height art band, an optional stat line, the rules/printed-text/
// flavor/pips block, footer.
// ---------------------------------------------------------------------------

export interface CardFaceLayout {
  readonly header: Rect;
  readonly headerRule: Rect;
  /** Null when there is no room left for art at all (an extremely short panel). */
  readonly art: Rect | null;
  readonly artRule: Rect | null;
  readonly stats: Rect | null;
  /**
   * The rules-text/printed-text/flavor/resource-pips block. Drawn as plain stacked text (and graphics, for the
   * pips) when the scene's own measurement says it fits — D08 draws no scrollbar on an ordinary card — or as a
   * `McScrollPanel` filling this same rect when it doesn't (`scenes/inspect.ts#drawCardPanel`'s own comment).
   */
  readonly scroll: Rect;
  readonly footerRule: Rect;
  readonly footer: Rect;
}

export interface CardFaceContent {
  /** The rules-text font size in play: 14, or 17 under `largeCardText` (`scenes/inspect.ts`'s own comment on that setting). Both the line height used here and the scene's own wrap-width measurement scale from it. */
  readonly bodySize: number;
  /** `estimateWrappedLines(model.rulesText, bodyWidth, bodySize * CHAR_WIDTH_RATIO)` — the scene's job, since only it knows the live wrap width. */
  readonly rulesTextLines: number;
  /** Wrapped lines of the printed-text-superseded-by-errata block, its own one-line label included. 0 for a card with no errata. */
  readonly printedTextLines: number;
  /** Wrapped lines of the flavor text, at 11px. 0 for a card with none. */
  readonly flavorLines: number;
  readonly hasStats: boolean;
  /** The resource-pip row ("Generates 2 energy when spent"). */
  readonly hasIcons: boolean;
}

const HEADER_HEIGHT = 62;
const FOOTER_HEIGHT = 30;
const RULE_WEIGHT = 4;
const STATS_HEIGHT = 22;
const ICONS_HEIGHT = 26;
/** D08's own `padding:14px` / `gap:10px` on the card's text block. */
const TEXT_PAD = 14;
const TEXT_GAP = 10;
/** D08's own 250px art band at its own 400px panel width — scaled to whatever width the panel actually draws at. */
const ART_ASPECT = 250 / 400;
/** Below this the art band reads as a sliver, not a picture, so it is dropped entirely rather than drawn tiny. */
const MIN_ART_HEIGHT = 60;
/** The floor the text block is guaranteed before the art is allowed to claim the rest — never zero, never negative. */
const MIN_TEXT_HEIGHT = 20;
const RULES_LINE_HEIGHT_RATIO = 1.45;
/** The printed-text-superseded-by-errata block always draws at 11px (point 4 of the owner's own list). */
const PRINTED_LINE_HEIGHT = 11 * RULES_LINE_HEIGHT_RATIO;
/** Flavor's own 11px/1.4 line height (D08's `font-style:italic;opacity:.65;line-height:1.4`). */
const FLAVOR_LINE_HEIGHT = 11 * 1.4;

function artHeightFor(width: number): number {
  return Math.round(width * ART_ASPECT);
}

/** The text block's own natural height: padding, the rules text, and whichever of printed text/flavor/pips are present, each with its own leading gap. */
function textBlockHeight(content: CardFaceContent): number {
  let inner = content.rulesTextLines * content.bodySize * RULES_LINE_HEIGHT_RATIO;
  if (content.printedTextLines > 0) inner += TEXT_GAP + content.printedTextLines * PRINTED_LINE_HEIGHT;
  if (content.flavorLines > 0) inner += TEXT_GAP + content.flavorLines * FLAVOR_LINE_HEIGHT;
  if (content.hasIcons) inner += TEXT_GAP + ICONS_HEIGHT;
  return TEXT_PAD * 2 + inner;
}

/**
 * The card panel's own natural (unclamped) height at `width` — what
 * `scenes/inspect.ts#rebuild` measures and hands to `inspectLayout` as
 * `cardContentHeight` (this file's own header comment, point 1).
 */
export function cardFaceContentHeight(width: number, content: CardFaceContent): number {
  const stats = content.hasStats ? STATS_HEIGHT + TEXT_GAP : 0;
  return (
    HEADER_HEIGHT +
    RULE_WEIGHT +
    artHeightFor(width) +
    RULE_WEIGHT +
    stats +
    textBlockHeight(content) +
    RULE_WEIGHT +
    FOOTER_HEIGHT
  );
}

/**
 * The card panel's own internal split, for whatever `rect` `panelsLayout` actually granted it — which may be
 * exactly `cardFaceContentHeight(rect.width, content)` (the ordinary case, nothing clamped) or shorter (the rules
 * panel was the taller of the pair, or the viewport itself capped both) or taller (the rules panel was taller and
 * every panel shares its height — the extra room becomes blank paper between the text block and the footer, which
 * stays pinned to the very bottom of `rect` either way).
 *
 * The art band is fixed at `ART_ASPECT` of the panel's own width (D08's own 250px-at-400px band) and only shrinks —
 * down to nothing, on a truly tiny panel — once the space below the header can't hold both it and a sliver of text.
 */
export function cardFaceLayout(rect: Rect, content: CardFaceContent): CardFaceLayout {
  const header: Rect = { x: rect.x, y: rect.y, width: rect.width, height: HEADER_HEIGHT };
  const headerRule: Rect = { x: rect.x, y: rect.y + HEADER_HEIGHT, width: rect.width, height: RULE_WEIGHT };

  const footer: Rect = { x: rect.x, y: rect.y + rect.height - FOOTER_HEIGHT, width: rect.width, height: FOOTER_HEIGHT };
  const footerRule: Rect = { x: rect.x, y: footer.y - RULE_WEIGHT, width: rect.width, height: RULE_WEIGHT };

  const artTop = rect.y + HEADER_HEIGHT + RULE_WEIGHT;
  const availableBelowHeader = Math.max(0, footerRule.y - artTop);
  const stats = content.hasStats ? STATS_HEIGHT + TEXT_GAP : 0;

  const desiredArt = artHeightFor(rect.width);
  // The art's own trailing rule (`RULE_WEIGHT`) is reserved here too, not just the art's height and the text
  // floor below it — omitting it let the art claim 4px more than `cardFaceContentHeight` had actually budgeted
  // for it, which shorted the scroll region by that same 4px in the ordinary (unclamped) case and, at the margin,
  // tipped an otherwise-fitting card into the `McScrollPanel` fallback (found reading a tablet-portrait screenshot
  // during D08 verification, 2026-09-21: a short Interrupt card scrolling when it had no need to).
  const reserveForText = Math.min(MIN_TEXT_HEIGHT + stats, availableBelowHeader);
  const artHeight = Math.max(0, Math.min(desiredArt, availableBelowHeader - RULE_WEIGHT - reserveForText));

  let bodyTop = artTop;
  let art: Rect | null = null;
  let artRule: Rect | null = null;
  if (artHeight >= MIN_ART_HEIGHT) {
    art = { x: rect.x + 5, y: artTop, width: rect.width - 10, height: artHeight };
    artRule = { x: rect.x, y: artTop + artHeight, width: rect.width, height: RULE_WEIGHT };
    bodyTop = artTop + artHeight + RULE_WEIGHT;
  }

  let stats_: Rect | null = null;
  if (content.hasStats) {
    stats_ = { x: rect.x + 14, y: bodyTop, width: rect.width - 28, height: STATS_HEIGHT };
    bodyTop += STATS_HEIGHT + TEXT_GAP;
  }

  const scroll: Rect = {
    x: rect.x + 10,
    y: bodyTop,
    width: rect.width - 20,
    height: Math.max(0, footerRule.y - bodyTop),
  };

  return { header, headerRule, art, artRule, stats: stats_, scroll, footerRule, footer };
}
