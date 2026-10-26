import { runningInLinuxDesktopApp } from "../platform/linux-desktop.js";

/**
 * The bitmap as a canvas, which is what Phaser is handed. Not the `ImageBitmap` itself: WebGL ignores
 * `UNPACK_FLIP_Y_WEBGL` for an `ImageBitmap`, and Phaser flips every texture it uploads, so a bitmap came out upside
 * down. A `bitmaprenderer` canvas takes the bitmap over without copying it and uploads like any other canvas.
 *
 * Except in the Linux desktop app (WebKitGTK; Bazzite, the Steam Deck): there a `bitmaprenderer` canvas keeps its pixels
 * in a GPU buffer that texImage2D read back wrongly, so baked tiles came out as blocky noise or blank frames, a
 * different set each run (the owner, 2026-10-24). That build copies the bitmap into a plain 2D canvas instead, a
 * software one (`willReadFrequently`), which uploads from ordinary memory, and closes the bitmap.
 */
export function canvasOf(
  bitmap: ImageBitmap,
  copyIntoPlainCanvas: boolean = runningInLinuxDesktopApp(),
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  if (!copyIntoPlainCanvas) {
    const renderer = canvas.getContext("bitmaprenderer");
    if (renderer) {
      renderer.transferFromImageBitmap(bitmap);
      return canvas;
    }
  }
  canvas.getContext("2d", { willReadFrequently: true })?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}
