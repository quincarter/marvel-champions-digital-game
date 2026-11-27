import type { FilterChip } from "./filter-bar.types.js";
import type { TabRailTab } from "./tab-rail.types.js";
import type { McButtonKind } from "./button.types.js";
import type { GlyphSpec, McGlyphGround } from "./glyph.types.js";

/** A box in the sheet's own coordinates (from its top left). */
export interface SheetRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A filled and/or outlined rectangle. A stroke is centered on the box's edge, as Phaser strokes it. */
export interface SheetBox {
  readonly kind: "box";
  /** A key the e2e and focus code can find the box by (a card whose place the focus ring follows). */
  readonly key?: string;
  readonly rect: SheetRect;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly dashed?: boolean;
  readonly opacity?: number;
  /** A circle (a lesson's number badge): the box is square and fully rounded. */
  readonly round?: boolean;
}

/** The table felt's dot grid over a box. */
export interface SheetDots {
  readonly kind: "dots";
  readonly rect: SheetRect;
  readonly color: string;
  readonly spacing: number;
  readonly radius: number;
  readonly opacity: number;
}

/** A label or a paragraph. `anchorX` / `anchorY` say which point of it sits at `x`, `y` (Phaser's origin). */
export interface SheetText {
  readonly kind: "text";
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly font: "display" | "body" | "mono";
  /** In px; a size of 12 or less grows on desktop when `small` is set (the client's desktop type bump). */
  readonly size: number;
  readonly small?: boolean;
  readonly weight: number;
  readonly color: string;
  readonly opacity?: number;
  readonly letterSpacing?: number;
  /** Line height in px (wrapped text). */
  readonly lineHeight?: number;
  readonly uppercase?: boolean;
  readonly align?: "left" | "center" | "right";
  readonly anchorX?: number;
  readonly anchorY?: number;
  /** Wraps at this width. */
  readonly wrapWidth?: number;
  /** One line that shrinks to fit this width, as Phaser's `fitText` does. */
  readonly fitWidth?: number;
  /** A wrapped text cut with an ellipsis after this many lines. */
  readonly maxLines?: number;
  /** A key the e2e and focus code can find the text by. */
  readonly key?: string;
  /** Letter ranges (`start` to `end`, exclusive) marked as a search match: a band behind them and a line under. */
  readonly marks?: readonly { readonly start: number; readonly end: number }[];
  readonly italic?: boolean;
  /** Turns the text about its anchor point, in degrees (Phaser's `setAngle`). */
  readonly angle?: number;
  /** An outline round the letters, drawn behind the fill (Phaser's `setStroke`): its colour and width in px. */
  readonly strokeColor?: string;
  readonly strokeWidth?: number;
}

/** A button: the client's `McButton` skins, pressed by a tap. */
export interface SheetButton {
  readonly kind: "button";
  readonly key: string;
  readonly rect: SheetRect;
  readonly label: string;
  readonly look: McButtonKind;
  readonly selected?: boolean;
  readonly disabled?: string | true;
  readonly framed?: boolean;
  /** A Bangers label. */
  readonly display?: boolean;
  /** A label in its own case with no tracking (a row title). */
  readonly plain?: boolean;
  /** The label's px size. */
  readonly size?: number;
  /** How far the label slides right to make room for a glyph beside it (px; eased when it changes). */
  readonly labelShift?: number;
  /** No label slide (reduced motion). */
  readonly still?: boolean;
  /** The keyboard chord that presses this button, as `aria-keyshortcuts` (e.g. "Escape", "Control+K"). */
  readonly keyshortcuts?: string;
  /** Faded but still pressable (a setting that has no effect while another is off). */
  readonly opacity?: number;
  /** The button's name for assistive tech when its label is a symbol ("+"), already translated. */
  readonly aria?: string;
}

/** An aspect chip (`mc-aspect-chip`) with its top left at `x`, `y`: decorative, the row it sits on takes the press. */
export interface SheetChip {
  readonly kind: "chip";
  readonly x: number;
  readonly y: number;
  readonly aspect: string;
  /** The aspect's name, already translated. */
  readonly label: string;
  readonly height?: number;
  readonly size?: number;
  readonly key?: string;
}

/** A key or controller-button glyph (`mc-glyph`) at its left edge `x`, vertically centered on `y`. Never takes a press. */
export interface SheetGlyph {
  readonly kind: "glyph";
  readonly x: number;
  readonly y: number;
  readonly specs: readonly GlyphSpec[];
  /** The glyph's height in px, already scaled by the hint size setting. */
  readonly height: number;
  readonly ground: McGlyphGround;
  readonly opacity?: number;
  /** 0 (folded away) to 1 (open). */
  readonly openness: number;
  /** No fold animation (reduced motion). */
  readonly still?: boolean;
  readonly key?: string;
}

/**
 * An invisible area a tap presses (a card, a row). With `inspect`, a press-and-hold or a right-click also raises
 * `mc-inspect` (a card's "look at this"), and the release that ended a hold is not a tap.
 */
export interface SheetTap {
  readonly kind: "tap";
  readonly key: string;
  readonly rect: SheetRect;
  readonly inspect?: boolean;
  /** Names the card the area shows (the client's card hover popover reads it). */
  readonly hover?: string;
  /** A mouse moving over or off the area raises `mc-hover` (a desktop shows a box's info before it is picked). */
  readonly track?: boolean;
}

/**
 * A picture (a card scan) in a box: the whole picture fitted inside it, on `fill`. It loads when it scrolls near
 * (`loading="lazy"`). With no `src`, or one that fails to load, the box says `missing` instead, as the client's
 * card tiles say "no scan". `hover` names the card the picture shows (the client's card hover popover reads it).
 */
export interface SheetImage {
  readonly kind: "image";
  readonly rect: SheetRect;
  readonly src: string | null;
  readonly fill?: string;
  /** What the box says while there is no picture (a missing scan), already translated. */
  readonly missing?: string;
  /** The text colour of `missing`. */
  readonly color?: string;
  readonly hover?: string;
  readonly key?: string;
  /**
   * Names where `src` came from, when the URL can go stale under the box (a blob URL revoked while the image had not
   * loaded yet). A failed load then raises `mc-image-error` once for this key, so the owner can hand a fresh URL.
   */
  readonly retry?: string;
  /** Fills the box, cropped (never stretched) around this focal point, 0 to 1 each way, instead of fitting whole. */
  readonly cover?: { readonly x: number; readonly y: number };
}

/** Ink dots thickening toward the foot of a box, the way the comic pages shade a panel (a game mode box's art). */
export interface SheetHalftone {
  readonly kind: "halftone";
  readonly rect: SheetRect;
  readonly color: string;
  /** The grid's spacing in px. */
  readonly step: number;
  /** How far up from the foot the dots reach, in px. */
  readonly fade: number;
  readonly opacity: number;
}

/** A filled polygon or an open line (a notch pointing at a box), its points in the sheet's own coordinates. */
export interface SheetPoly {
  readonly kind: "poly";
  readonly points: readonly (readonly [number, number])[];
  /** Filled and closed (a polygon); left out, it is an open line, only stroked. */
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}

/** A QR code: dark modules on a light ground, with a quiet zone of `border` modules, scaled to fill `rect`. */
export interface SheetQr {
  readonly kind: "qr";
  readonly key?: string;
  readonly rect: SheetRect;
  /** One string per module row, "1" for a dark module. */
  readonly rows: readonly string[];
  /** The quiet zone round the modules, in modules. */
  readonly border: number;
  readonly background: string;
  readonly foreground: string;
}

export interface SvgStyle {
  readonly fill?: string;
  readonly stroke?: string;
  readonly sw?: number;
  readonly alpha?: number;
  readonly dash?: readonly [number, number];
}

/** One drawn shape of a `SheetSvg`, in the drawing's own units. */
export type SvgOp =
  | ({
      readonly k: "rect";
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly rx?: number;
    } & SvgStyle)
  | ({ readonly k: "circle"; readonly cx: number; readonly cy: number; readonly r: number } & SvgStyle)
  | ({
      readonly k: "line";
      readonly x1: number;
      readonly y1: number;
      readonly x2: number;
      readonly y2: number;
    } & SvgStyle)
  | ({ readonly k: "path"; readonly d: string } & SvgStyle)
  | {
      readonly k: "text";
      readonly x: number;
      readonly y: number;
      readonly text: string;
      readonly size: number;
      readonly weight: number;
      readonly anchor: "start" | "middle" | "end";
      readonly fill: string;
      readonly alpha?: number;
      readonly spacing?: number;
      readonly font: "display" | "body";
    }
  | {
      readonly k: "image";
      readonly href: string;
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    };

/** A drawing (the Controls screen's controller): shapes and text laid out in `viewBox` units, scaled to `rect`. */
export interface SheetSvg {
  readonly kind: "svg";
  readonly key?: string;
  readonly rect: SheetRect;
  readonly viewBox: readonly [number, number];
  readonly ops: readonly SvgOp[];
  /** Said over the drawing when one of its pictures fails to load (already translated). */
  readonly missing?: string;
}

/**
 * A stepped slider: "−", a track with a filled share and a round knob, "+", and the value as text. A tap on the track
 * or a sideways drag along it raises `mc-slide` (`share` 0 to 1 along the track; `commit` false while dragging and true
 * on the release); a drag that goes up or down is the page's scroll and changes nothing. "−" and "+" raise `mc-step`.
 */
export interface SheetSlider {
  readonly kind: "slider";
  readonly key: string;
  readonly rect: SheetRect;
  /** The knob's share along the track (0 to 1). */
  readonly share: number;
  /** The value as text ("125%"), already formatted. */
  readonly label: string;
  /** Faded but still adjustable. */
  readonly dimmed?: boolean;
  /** The ground the slider sits on, for the track's colour. */
  readonly ground: "ink" | "paper";
  readonly stepLabels: readonly [string, string];
}

/** A section heading with its rule (`mc-section-header`), its top left at the rect's. */
export interface SheetSectionHeader {
  readonly kind: "sectionHeader";
  readonly rect: SheetRect;
  readonly label: string;
  readonly size?: number;
  readonly key?: string;
}

/** A rail of tabs (`mc-tab-rail`): a tap on a cell raises `mc-activate` with `prefix + id` as its key. */
export interface SheetTabRail {
  readonly kind: "tabRail";
  readonly rect: SheetRect;
  readonly tabs: readonly TabRailTab[];
  readonly prefix?: string;
  readonly size?: number;
  readonly key?: string;
}

/** A framed picture (`mc-picture-tile`): cropped around a focal point, or fitted whole; `missing` says so when it has none. */
export interface SheetPictureTile {
  readonly kind: "pictureTile";
  readonly rect: SheetRect;
  readonly src: string | null;
  readonly missing?: string;
  readonly fit?: "cover" | "contain";
  readonly focus?: { readonly x: number; readonly y: number };
  /** The ink frame's width in px (2 when absent, 0 for none). */
  readonly frame?: number;
  /** Names the card the picture shows (the client's card hover popover reads it). */
  readonly hover?: string;
  /** Names where `src` came from, as `SheetImage.retry`. */
  readonly retry?: string;
  readonly key?: string;
}

/** A search box (`mc-search-field`, a real input): raises `mc-search` (debounced), `mc-search-submit` and `mc-field-focus` with its key. */
export interface SheetSearchField {
  readonly kind: "searchField";
  readonly key: string;
  readonly rect: SheetRect;
  readonly value: string;
  readonly placeholder: string;
  readonly clearLabel: string;
}

/** A wrapping row of filter chips (`mc-filter-bar`): a tap raises `mc-activate` with `prefix + id`. */
export interface SheetFilterBar {
  readonly kind: "filterBar";
  readonly key: string;
  readonly rect: SheetRect;
  readonly chips: readonly FilterChip[];
  readonly prefix?: string;
  readonly rows?: number;
  readonly rowHeight?: number;
}

/** A framed row (`mc-list-row`): a picture, a title, meta lines and a state badge. A tap raises `mc-activate`. */
export interface SheetListRow {
  readonly kind: "listRow";
  readonly key: string;
  readonly rect: SheetRect;
  readonly heading: string;
  readonly meta: string;
  readonly summary: string;
  readonly foot: string;
  readonly badge: string;
  readonly solid?: boolean;
  readonly src: string | null;
  readonly letter: string;
  readonly retry?: string;
  readonly focusY?: number;
  readonly fit?: "cover" | "contain";
}

/** A scrolling region: its own nodes, laid out in its content space (`height` tall). */
export interface SheetScroll {
  readonly kind: "scroll";
  readonly key: string;
  readonly rect: SheetRect;
  readonly height: number;
  readonly nodes: readonly SheetNode[];
}

export type SheetNode =
  | SheetBox
  | SheetDots
  | SheetText
  | SheetButton
  | SheetGlyph
  | SheetChip
  | SheetImage
  | SheetHalftone
  | SheetPoly
  | SheetTap
  | SheetQr
  | SheetSvg
  | SheetSlider
  | SheetSectionHeader
  | SheetTabRail
  | SheetPictureTile
  | SheetSearchField
  | SheetFilterBar
  | SheetListRow
  | SheetScroll;
