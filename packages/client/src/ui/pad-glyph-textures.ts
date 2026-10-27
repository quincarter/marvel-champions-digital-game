/**
 * Bakes the controller button pictures (`view/pad-glyph-art.ts`) into textures, once per game: kicked off at boot, and
 * again by the first glyph that asks if boot didn't. Decoding an SVG is asynchronous, so until a texture lands
 * `McInputGlyph` draws its plain shape and measures again when `Phaser.Textures.Events.ADD` names the key.
 */

import type Phaser from "phaser";
import { surface } from "../tokens.js";
import {
  PAD_GLYPH_ARTS,
  glyphArtColors,
  glyphArtSize,
  glyphArtSvg,
  type GlyphArtGround,
  type PadGlyphArtId,
} from "../view/pad-glyph-art.js";

/** Pixel height the pictures are rasterized at: crisp at the largest hint size on a 2x screen. */
const RASTER_HEIGHT = 128;

export function padGlyphTextureKey(id: PadGlyphArtId, ground: GlyphArtGround): string {
  return `pad-glyph:${id}:${ground}`;
}

const baking = new WeakSet<Phaser.Textures.TextureManager>();

/** Starts baking every picture on both grounds into this game's textures; a no-op after the first call. */
export function ensurePadGlyphTextures(textures: Phaser.Textures.TextureManager): void {
  if (baking.has(textures)) return;
  baking.add(textures);
  const palette = { ink: surface.ink.hex, paper: surface.paper.hex, card: surface.card.hex };
  for (const id of PAD_GLYPH_ARTS) {
    const size = glyphArtSize(id);
    const scale = RASTER_HEIGHT / size.height;
    for (const ground of ["ink", "paper"] as const) {
      const key = padGlyphTextureKey(id, ground);
      if (textures.exists(key)) continue;
      // The SVG's own width and height set the decoded size, so they are scaled up before decoding.
      const svg = glyphArtSvg(id, glyphArtColors(id, ground, palette)).replace(
        /width="[\d.]+" height="[\d.]+"/,
        `width="${Math.round(size.width * scale)}" height="${RASTER_HEIGHT}"`,
      );
      const image = new Image();
      image.onload = () => {
        // The game may be gone by the time it decodes (a hot reload).
        if (textures.game && !textures.exists(key)) textures.addImage(key, image);
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
  }
}
