/**
 * Builds an `mc-sheet` (`@mc/ui`) the way a scene drew in Phaser: boxes, the dot grid, text, buttons and tap areas
 * at layout rects, with the same type specs and token colors. Porting a hand-placed Phaser screen is then a matter of
 * calling these where it called `this.add.*`, so it keeps the same look and layout (PLAN.md Phase 4, Lit panels).
 *
 * - Colors are given as the token hex Phaser took, and drawn as the panel layer's custom property for that token and
 *   channel (`dom/ui-layer.ts`), so dark mode maps them as it maps Phaser's. A color that isn't a token is drawn as is.
 * - Text that later parts are placed against (Phaser's `text.height`, `text.width`) is measured in the DOM, in the
 *   same font the sheet draws it in (`measure`).
 * - Coordinates are the screen's; the builder subtracts the sheet's own origin.
 */
import type { GlyphSpec as UiGlyphSpec, McGlyphGround, SheetNode, SheetRect } from "@mc/ui";
import { accent, font, signal, status, surface, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { uiLayer } from "./ui-layer.js";
import type Phaser from "phaser";

type Channel = "text" | "fill" | "line";

/** Token colors by hex, to the name the panel layer gives them (`--mc-<channel>-<name>`). */
const TOKEN_NAMES = new Map<number, string>([
  [surface.void.hex, "void"],
  [surface.ink.hex, "ink"],
  [surface.paper.hex, "paper"],
  [surface.parchment.hex, "parchment"],
  [surface.card.hex, "card"],
  [surface.inkOnHue.hex, "ink-on-hue"],
  [accent.heroRed.hex, "red"],
  [accent.redDeep.hex, "red-deep"],
  [signal.cost.hex, "cost"],
  [signal.heal.hex, "heal"],
  [signal.caution.hex, "caution"],
  [signal.spent.hex, "spent"],
  [status.stunned.hex, "stunned"],
  [status.confused.hex, "confused"],
  [status.tough.hex, "tough"],
]);

const hex6 = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** A color as the sheet draws it: the layer's variable for a token (so dark mode applies), else the color itself. */
export function sheetColor(hex: number, channel: Channel): string {
  const name = TOKEN_NAMES.get(hex);
  return name ? `var(--mc-${channel}-${name}, ${hex6(hex)})` : hex6(hex);
}

/** Every token the sheet names; the panel layer must define each (`sheet-builder.test.ts` checks it does). */
export const SHEET_TOKENS: ReadonlyMap<number, string> = TOKEN_NAMES;

export interface TextOptions {
  readonly size?: number;
  readonly color: number;
  readonly alpha?: number;
  readonly wrapWidth?: number;
  readonly fitWidth?: number;
  /** A wrapped text cut with an ellipsis after this many lines. */
  readonly maxLines?: number;
  /** Phaser's `setLineSpacing`: extra px between lines. */
  readonly lineSpacing?: number;
  readonly origin?: readonly [number, number];
  readonly align?: "left" | "center" | "right";
  readonly letterSpacing?: number;
  readonly key?: string;
  readonly italic?: boolean;
  /** Turns the text about its origin, in degrees (Phaser's `setAngle`). */
  readonly angle?: number;
  /** An outline behind the letters (Phaser's `setStroke`): token color and width. */
  readonly stroke?: { readonly color: number; readonly width: number };
  /** Letter ranges drawn as a search match. */
  readonly marks?: readonly { readonly start: number; readonly end: number }[];
}

/** The size a text takes, measured in the DOM in the font the sheet draws it in. */
export interface Measured {
  readonly width: number;
  readonly height: number;
}

let measurer: HTMLSpanElement | null = null;

function measureNode(game: Phaser.Game, text: string, style: Readonly<Record<string, string>>): Measured {
  if (!measurer?.isConnected) {
    measurer = document.createElement("span");
    Object.assign(measurer.style, { position: "absolute", visibility: "hidden", left: "-10000px", top: "0" });
    uiLayer(game).append(measurer);
  }
  measurer.removeAttribute("style");
  Object.assign(measurer.style, { position: "absolute", visibility: "hidden", left: "-10000px", top: "0" }, style);
  measurer.textContent = text;
  return { width: measurer.offsetWidth, height: measurer.offsetHeight };
}

export class SheetBuilder {
  readonly nodes: SheetNode[] = [];
  readonly #origin: { readonly x: number; readonly y: number };
  readonly #game: Phaser.Game;
  readonly #desktop: () => boolean;

  constructor(game: Phaser.Game, origin: { readonly x: number; readonly y: number }, desktop: () => boolean) {
    this.#game = game;
    this.#origin = origin;
    this.#desktop = desktop;
  }

  #rect(rect: Rect): SheetRect {
    return { x: rect.x - this.#origin.x, y: rect.y - this.#origin.y, width: rect.width, height: rect.height };
  }

  /** A filled and/or outlined box (Phaser's `fillRect` / `strokeRect`, the stroke centered on the edge). */
  box(
    rect: Rect,
    look: {
      readonly fill?: number;
      readonly fillAlpha?: number;
      readonly stroke?: number;
      readonly strokeWidth?: number;
      readonly dashed?: boolean;
      readonly alpha?: number;
      readonly key?: string;
      /** A circle: give it a square rect. */
      readonly round?: boolean;
    },
  ): void {
    const fill = look.fill !== undefined ? sheetColor(look.fill, "fill") : undefined;
    this.nodes.push({
      kind: "box",
      ...(look.key !== undefined ? { key: look.key } : {}),
      rect: this.#rect(rect),
      ...(fill !== undefined
        ? {
            fill:
              look.fillAlpha !== undefined && look.fillAlpha < 1
                ? `color-mix(in srgb, ${fill} ${Math.round(look.fillAlpha * 100)}%, transparent)`
                : fill,
          }
        : {}),
      ...(look.stroke !== undefined ? { stroke: sheetColor(look.stroke, "line") } : {}),
      ...(look.strokeWidth !== undefined ? { strokeWidth: look.strokeWidth } : {}),
      ...(look.dashed ? { dashed: true } : {}),
      ...(look.alpha !== undefined ? { opacity: look.alpha } : {}),
      ...(look.round ? { round: true } : {}),
    });
  }

  /** The felt's dot grid (`paintDotGrid`), on an ink or paper ground. */
  dots(rect: Rect, ground: "ink" | "paper", spacing: number, radius: number, alpha: number): void {
    this.nodes.push({
      kind: "dots",
      rect: this.#rect(rect),
      color: sheetColor(ground === "ink" ? surface.paper.hex : surface.ink.hex, "fill"),
      spacing,
      radius,
      opacity: alpha,
    });
  }

  #textStyle(
    spec: TypeSpec,
    options: TextOptions,
  ): { node: Omit<SheetNode & { kind: "text" }, "x" | "y" | "text">; css: Record<string, string> } {
    const size = options.size ?? spec.size;
    const fontKey = spec.family === font.display ? "display" : spec.family === font.mono ? "mono" : "body";
    const letterSpacing = options.letterSpacing ?? spec.letterSpacing;
    const lineHeight = options.lineSpacing !== undefined ? size * 1.2 + options.lineSpacing : undefined;
    const drawn = this.#desktop() && size <= 12 ? Math.min(13, size + 2) : size;
    const node = {
      kind: "text" as const,
      font: fontKey as "display" | "body" | "mono",
      size,
      small: true,
      weight: spec.weight,
      color: sheetColor(options.color, "text"),
      ...(options.alpha !== undefined && options.alpha < 1 ? { opacity: options.alpha } : {}),
      ...(letterSpacing ? { letterSpacing } : {}),
      ...(lineHeight !== undefined ? { lineHeight } : {}),
      ...(spec.uppercase ? { uppercase: true } : {}),
      ...(options.align ? { align: options.align } : {}),
      ...(options.origin ? { anchorX: options.origin[0], anchorY: options.origin[1] } : {}),
      ...(options.wrapWidth !== undefined ? { wrapWidth: options.wrapWidth } : {}),
      ...(options.fitWidth !== undefined ? { fitWidth: options.fitWidth } : {}),
      ...(options.maxLines !== undefined ? { maxLines: options.maxLines } : {}),
      ...(options.key !== undefined ? { key: options.key } : {}),
      ...(options.marks?.length ? { marks: options.marks } : {}),
      ...(options.italic ? { italic: true } : {}),
      ...(options.angle ? { angle: options.angle } : {}),
      ...(options.stroke
        ? { strokeColor: sheetColor(options.stroke.color, "text"), strokeWidth: options.stroke.width }
        : {}),
    };
    const familyName = fontKey === "display" ? font.display : fontKey === "mono" ? font.mono : font.body;
    const css: Record<string, string> = {
      fontFamily: `"${familyName}", sans-serif`,
      fontSize: `${drawn}px`,
      fontWeight: String(spec.weight),
      lineHeight: lineHeight !== undefined ? `${lineHeight}px` : "1.2",
      letterSpacing: letterSpacing ? `${letterSpacing}px` : "normal",
      textTransform: spec.uppercase ? "uppercase" : "none",
      fontStyle: options.italic ? "italic" : "normal",
      whiteSpace: options.wrapWidth !== undefined ? "pre-wrap" : "pre",
      // A long unbroken word or URL breaks at the width instead of running out of its box.
      ...(options.wrapWidth !== undefined ? { overflowWrap: "anywhere" } : {}),
      ...(options.wrapWidth !== undefined ? { width: `${options.wrapWidth}px` } : {}),
    };
    return { node, css };
  }

  /** How big `text` is in `spec`, without drawing it. */
  measure(text: string, spec: TypeSpec, options: Omit<TextOptions, "color"> = {}): Measured {
    const { css } = this.#textStyle(spec, { ...options, color: surface.ink.hex });
    const measured = measureNode(this.#game, text, css);
    return options.fitWidth !== undefined
      ? { ...measured, width: Math.min(measured.width, options.fitWidth) }
      : measured;
  }

  /** A text at (`x`, `y`) with `origin` its anchor; returns its measured size, as Phaser's `Text` has one. */
  text(x: number, y: number, text: string, spec: TypeSpec, options: TextOptions): Measured {
    const { node } = this.#textStyle(spec, options);
    this.nodes.push({ ...node, x: x - this.#origin.x, y: y - this.#origin.y, text });
    // Measured when a later part asks (a layout read each), not for every text drawn: a long list draws thousands that
    // nothing is placed against.
    let measured: Measured | null = null;
    const size = (): Measured => (measured ??= this.measure(text, spec, options));
    return {
      get width() {
        return size().width;
      },
      get height() {
        return size().height;
      },
    };
  }

  button(options: {
    readonly key: string;
    readonly rect: Rect;
    readonly label: string;
    readonly look: "primary" | "secondary" | "quiet" | "onInk" | "rail";
    readonly selected?: boolean;
    readonly disabled?: string | true;
    readonly framed?: boolean;
    readonly type?: TypeSpec;
    /** The label slides right by this many px to make room for a glyph beside it. */
    readonly labelShift?: number;
    /** The label slides with no animation (reduced motion). */
    readonly still?: boolean;
  }): void {
    const type = options.type;
    this.nodes.push({
      ...(options.labelShift ? { labelShift: options.labelShift } : {}),
      ...(options.still ? { still: true } : {}),
      kind: "button",
      key: options.key,
      rect: this.#rect(options.rect),
      label: options.label,
      look: options.look,
      ...(options.selected ? { selected: true } : {}),
      ...(options.disabled !== undefined ? { disabled: options.disabled } : {}),
      ...(options.framed ? { framed: true } : {}),
      ...(type?.family === font.display ? { display: true } : {}),
      ...(type && !type.uppercase && type.family !== font.display ? { plain: true } : {}),
      ...(type ? { size: this.#desktop() && type.size <= 12 ? Math.min(13, type.size + 2) : type.size } : {}),
    });
  }

  /** Ink dots thickening toward the foot of `rect` (a comic panel's shading): `step` px apart, reaching `fade` px up. */
  halftone(
    rect: Rect,
    look: { readonly color: number; readonly step: number; readonly fade: number; readonly alpha: number },
  ): void {
    this.nodes.push({
      kind: "halftone",
      rect: this.#rect(rect),
      color: sheetColor(look.color, "fill"),
      step: look.step,
      fade: look.fade,
      opacity: look.alpha,
    });
  }

  /** A filled polygon, or with no `fill` an open line, through `points`. */
  poly(
    points: readonly (readonly [number, number])[],
    look: { readonly fill?: number; readonly stroke?: number; readonly strokeWidth?: number },
  ): void {
    this.nodes.push({
      kind: "poly",
      points: points.map(([x, y]) => [x - this.#origin.x, y - this.#origin.y] as const),
      ...(look.fill !== undefined ? { fill: sheetColor(look.fill, "fill") } : {}),
      ...(look.stroke !== undefined ? { stroke: sheetColor(look.stroke, "line") } : {}),
      ...(look.strokeWidth !== undefined ? { strokeWidth: look.strokeWidth } : {}),
    });
  }

  /** A key or controller-button glyph (`mc-glyph`) with its left edge at `x` and vertical center at `y`. */
  glyph(options: {
    readonly x: number;
    readonly y: number;
    readonly specs: readonly UiGlyphSpec[];
    readonly height: number;
    readonly ground: McGlyphGround;
    readonly openness: number;
    readonly still?: boolean;
    readonly key?: string;
  }): void {
    this.nodes.push({
      kind: "glyph",
      x: options.x - this.#origin.x,
      y: options.y - this.#origin.y,
      specs: options.specs,
      height: options.height,
      ground: options.ground,
      openness: options.openness,
      ...(options.still ? { still: true } : {}),
      ...(options.key !== undefined ? { key: options.key } : {}),
    });
  }

  /** An invisible press area. `inspect`: a press-and-hold or right-click also raises `mc-inspect` (a card's "look at this"). */
  tap(
    key: string,
    rect: Rect,
    options: { readonly inspect?: boolean; readonly hover?: string; readonly track?: boolean } = {},
  ): void {
    this.nodes.push({
      kind: "tap",
      key,
      rect: this.#rect(rect),
      ...(options.inspect ? { inspect: true } : {}),
      ...(options.hover !== undefined ? { hover: options.hover } : {}),
      ...(options.track ? { track: true } : {}),
    });
  }

  /**
   * A card scan (or any picture) fitted whole inside `rect`, on `fill` (a token). `src` null, or a file that fails to
   * load, shows `missing` instead. `hover` is the card id the card hover popover reads off it.
   */
  image(
    rect: Rect,
    options: {
      readonly src: string | null;
      readonly fill?: number;
      readonly missing?: string;
      readonly color?: number;
      readonly hover?: string;
      readonly key?: string;
      /** Fills the box, cropped around this focal point (0 to 1 each way), instead of fitting the whole picture. */
      readonly cover?: { readonly x: number; readonly y: number };
    },
  ): void {
    this.nodes.push({
      kind: "image",
      ...(options.cover ? { cover: options.cover } : {}),
      rect: this.#rect(rect),
      src: options.src,
      ...(options.fill !== undefined ? { fill: sheetColor(options.fill, "fill") } : {}),
      ...(options.missing !== undefined ? { missing: options.missing } : {}),
      ...(options.color !== undefined ? { color: sheetColor(options.color, "text") } : {}),
      ...(options.hover !== undefined ? { hover: options.hover } : {}),
      ...(options.key !== undefined ? { key: options.key } : {}),
    });
  }

  /** A scrolling region at `rect`, `height` tall inside, its parts built in its own content space (`y` from 0). */
  scroll(key: string, rect: Rect, height: number, build: (inner: SheetBuilder) => void): void {
    const inner = new SheetBuilder(this.#game, { x: rect.x, y: 0 }, this.#desktop);
    build(inner);
    this.nodes.push({ kind: "scroll", key, rect: this.#rect(rect), height, nodes: inner.nodes });
  }
}
