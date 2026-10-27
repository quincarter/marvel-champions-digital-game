/**
 * `McInputGlyph`: draws a key cap, a chord of key caps or a controller button (`view/input-glyph-model.ts` says
 * which). Face buttons are round discs with the label in Public Sans 800; shoulders, triggers and system buttons are
 * square pills in Public Sans 800; key caps are squares with a thicker bottom edge. On ink chrome the glyph is
 * paper-filled with ink text; on paper it is ink-outlined white. A controller button with a picture is drawn as that
 * picture instead (`view/pad-glyph-art.ts`) once its texture is baked; the glyph then emits `INPUT_GLYPH_RESIZED`. `openness` 0 shrinks it to a 6px tab on the control's edge.
 *
 * The container's origin is the left edge, vertically centered, so a button lays its label out at `x + glyphWidth`.
 */

import Phaser from "phaser";
import { font, surface, type TypeSpec } from "../tokens.js";
import type { FaceSymbol, GlyphSpec } from "../view/input-glyph-model.js";
import { glyphArtDrawSize } from "../view/pad-glyph-art.js";
import { textStyle } from "./theme.js";
import { ensurePadGlyphTextures, padGlyphTextureKey } from "./pad-glyph-textures.js";

export type GlyphGround = "ink" | "paper";

export const GLYPH_TAB_WIDTH = 6;
/** Emitted when a picture lands and the glyph's width changes: whoever laid it out lays it out again. */
export const INPUT_GLYPH_RESIZED = "inputglyphresized";
const CHORD_GAP = 4;

export interface InputGlyphOptions {
  /** Glyph height in px; a face disc's diameter. Default 24. */
  readonly height?: number;
  readonly ground?: GlyphGround;
  readonly openness?: number;
}

const type = (family: string, size: number, weight: 400 | 800): TypeSpec => ({
  family,
  size,
  weight,
  lineHeight: 1,
  letterSpacing: 0,
  uppercase: false,
});

interface Cell {
  readonly spec: GlyphSpec;
  readonly width: number;
  readonly height: number;
  readonly round: boolean;
  readonly symbol: FaceSymbol | null;
  readonly text: Phaser.GameObjects.Text | null;
  /** The button's picture, drawn in place of the shape and label. */
  readonly image: Phaser.GameObjects.Image | null;
}

export class McInputGlyph extends Phaser.GameObjects.Container {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private cells: Cell[] = [];
  private glyphHeight: number;
  private specs: readonly GlyphSpec[] = [];
  private ground: GlyphGround;
  private openness: number;
  /** Texture keys this glyph is waiting on: it measures again when one lands. */
  private pending = new Set<string>();
  private readonly onTextureAdded = (key: string): void => {
    if (!this.pending.has(key)) return;
    this.setSpecs(this.specs);
    this.emit(INPUT_GLYPH_RESIZED, this);
  };
  /** The drawn width at the current openness. */
  glyphWidth = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, specs: readonly GlyphSpec[], options: InputGlyphOptions = {}) {
    super(scene, x, y);
    this.glyphHeight = options.height ?? 24;
    this.ground = options.ground ?? "ink";
    this.openness = options.openness ?? 1;
    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    scene.add.existing(this);
    scene.textures.on(Phaser.Textures.Events.ADD, this.onTextureAdded);
    this.once(Phaser.GameObjects.Events.DESTROY, () =>
      scene.textures.off(Phaser.Textures.Events.ADD, this.onTextureAdded),
    );
    this.setSpecs(specs);
  }

  /** Resizes the glyph (the hint size setting): the cells are measured again at the new height. */
  setGlyphHeight(height: number): this {
    if (height === this.glyphHeight) return this;
    this.glyphHeight = height;
    return this.setSpecs(this.specs);
  }

  setSpecs(specs: readonly GlyphSpec[]): this {
    this.specs = specs;
    for (const cell of this.cells) {
      cell.text?.destroy();
      cell.image?.destroy();
    }
    this.pending.clear();
    this.cells = specs.map((spec) => this.measure(spec));
    this.redraw();
    return this;
  }

  setOpenness(openness: number): this {
    const next = Math.min(1, Math.max(0, openness));
    if (next !== this.openness) {
      this.openness = next;
      this.redraw();
    }
    return this;
  }

  setGround(ground: GlyphGround): this {
    if (ground !== this.ground) {
      this.ground = ground;
      // A picture is baked per ground, so it is looked up again.
      if (this.specs.some((spec) => spec.kind === "pad" && spec.art !== undefined)) this.setSpecs(this.specs);
      else this.redraw();
    }
    return this;
  }

  /** The width when fully open, for a button that reserves room for it. */
  get fullWidth(): number {
    return this.cells.reduce((sum, cell, i) => sum + cell.width + (i > 0 ? CHORD_GAP : 0), 0);
  }

  private measure(spec: GlyphSpec): Cell {
    const h = this.glyphHeight;
    const inkHex = surface.ink.hex;
    if (spec.kind === "pad" && spec.art !== undefined) {
      const key = padGlyphTextureKey(spec.art, this.ground);
      if (this.scene.textures.exists(key)) {
        const size = glyphArtDrawSize(spec.art, h);
        // Named for its label, so a test can find the button the picture shows.
        const image = this.scene.add.image(0, 0, key).setName(`glyph:${spec.label}`);
        this.add(image);
        return {
          spec,
          width: size.width,
          height: size.height,
          round: false,
          symbol: null,
          text: null,
          image,
        };
      }
      // Until the picture is baked the plain shape stands in.
      this.pending.add(key);
      ensurePadGlyphTextures(this.scene.textures);
    }
    if (spec.kind === "pad" && spec.shape === "face") {
      const text = spec.symbol
        ? null
        : this.scene.add
            .text(0, 0, spec.label, textStyle(type(font.body, Math.round(h * 0.55), 800), spec.color ?? inkHex))
            .setOrigin(0.5);
      if (text) this.add(text);
      return { spec, width: h, height: h, round: true, symbol: spec.symbol, text, image: null };
    }
    const pillH = spec.kind === "key" ? h : Math.round(h * 0.85);
    const text = this.scene.add
      .text(0, 0, spec.label, textStyle(type(font.body, Math.max(8, Math.round(pillH * 0.55)), 800), inkHex))
      .setOrigin(0.5);
    this.add(text);
    const minWidth = spec.kind === "key" ? pillH : 0;
    const width = Math.max(minWidth, Math.ceil(text.width) + Math.round(pillH * 0.6));
    return { spec, width, height: pillH, round: false, symbol: null, text, image: null };
  }

  private redraw(): void {
    const g = this.gfx;
    g.clear();
    const o = this.openness;
    const gaps = Math.max(0, this.cells.length - 1);
    const full = this.fullWidth;
    const gap = CHORD_GAP * o;
    const width = GLYPH_TAB_WIDTH + (full - GLYPH_TAB_WIDTH) * o;
    this.glyphWidth = width;
    const bodyFill = this.ground === "ink" ? surface.paper.hex : surface.card.hex;
    const inkHex = surface.ink.hex;
    const cellsWidth = width - gap * gaps;
    const cellsFull = full - CHORD_GAP * gaps;
    let x = 0;
    this.cells.forEach((cell, i) => {
      if (i > 0) x += gap;
      const w = cellsFull > 0 ? (cell.width / cellsFull) * cellsWidth : cell.width;
      const top = -cell.height / 2;
      if (cell.image) {
        // The picture squeezes toward the tab and fades like a label does.
        cell.image
          .setPosition(x + w / 2, 0)
          .setDisplaySize(Math.max(1, w), cell.height)
          .setAlpha(Math.min(1, Math.max(0, (o - 0.4) / 0.6)));
        x += w;
        return;
      }
      // An Xbox face button is an ink disc with a colored letter; on ink chrome it gets a paper ring so it reads.
      const colored = cell.spec.kind === "pad" && cell.spec.color !== undefined;
      g.fillStyle(colored ? inkHex : bodyFill, 1);
      g.lineStyle(2, colored && this.ground === "ink" ? surface.paper.hex : inkHex, 1);
      if (cell.round && o >= 1) {
        const r = cell.height / 2;
        g.fillCircle(x + r, 0, r);
        g.strokeCircle(x + r, 0, r);
      } else if (cell.round) {
        // A disc narrows to a rounded tab as it collapses.
        const radius = Math.min(cell.height / 2, w / 2);
        g.fillRoundedRect(x, top, w, cell.height, radius);
        g.strokeRoundedRect(x, top, w, cell.height, radius);
      } else {
        g.fillRect(x, top, w, cell.height);
        g.strokeRect(x, top, w, cell.height);
        if (cell.spec.kind === "key") {
          // The cap's thicker bottom edge.
          g.lineStyle(4, inkHex, 1);
          g.lineBetween(x, top + cell.height - 1, x + w, top + cell.height - 1);
        }
      }
      const fade = Math.min(1, Math.max(0, (o - 0.4) / 0.6));
      if (cell.symbol && fade > 0) this.drawSymbol(cell.symbol, x + w / 2, cell.height * 0.25, fade);
      cell.text?.setPosition(x + w / 2, 0).setAlpha(fade);
      x += w;
    });
  }

  private drawSymbol(symbol: FaceSymbol, cx: number, r: number, alpha: number): void {
    const g = this.gfx;
    g.lineStyle(2, surface.ink.hex, alpha);
    switch (symbol) {
      case "cross":
        g.lineBetween(cx - r, -r, cx + r, r);
        g.lineBetween(cx - r, r, cx + r, -r);
        break;
      case "circle":
        g.strokeCircle(cx, 0, r);
        break;
      case "square":
        g.strokeRect(cx - r, -r, r * 2, r * 2);
        break;
      case "triangle":
        g.strokeTriangle(cx, -r, cx + r, r * 0.8, cx - r, r * 0.8);
        break;
    }
  }
}
