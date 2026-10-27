/**
 * Bakes the controller button pictures (`view/pad-glyph-art.ts`) into textures, once per game: kicked off at boot, and
 * again by the first glyph that asks if boot didn't. Decoding an SVG is asynchronous, so until a texture lands
 * `McInputGlyph` draws its plain shape and measures again when `Phaser.Textures.Events.ADD` names the key. The white
 * pictures get an ink outline baked round them here, so they read on light and dark chrome alike.
 */

import type Phaser from "phaser";
import { surface } from "../tokens.js";
import {
  GLYPH_ART_OUTLINE,
  PAD_GLYPH_ARTS,
  glyphArtColors,
  glyphArtSize,
  glyphArtSvg,
  isColoredGlyphArt,
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
    const pad = isColoredGlyphArt(id) ? 0 : Math.round(GLYPH_ART_OUTLINE * scale);
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
        if (!textures.game || textures.exists(key)) return;
        if (pad === 0) textures.addImage(key, image);
        else textures.addCanvas(key, outlined(image, pad, surface.ink.hex));
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
  }
}

/** The picture on a canvas `pad` px larger all round, ringed by a `pad`-wide outline of its own silhouette. */
function outlined(image: HTMLImageElement, pad: number, color: number): HTMLCanvasElement {
  const width = image.width + pad * 2;
  const height = image.height + pad * 2;
  const silhouette = document.createElement("canvas");
  silhouette.width = width;
  silhouette.height = height;
  const sil = silhouette.getContext("2d")!;
  sil.drawImage(image, pad, pad);
  sil.globalCompositeOperation = "source-in";
  sil.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  sil.fillRect(0, 0, width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  // The silhouette stamped round a circle of radius `pad` thickens it into the outline.
  for (let step = 0; step < 48; step++) {
    const angle = (step / 48) * Math.PI * 2;
    ctx.drawImage(silhouette, Math.cos(angle) * pad, Math.sin(angle) * pad);
  }
  ctx.drawImage(image, pad, pad);
  return canvas;
}
