/**
 * The bitmap as a canvas, which is what Phaser is handed. Not the `ImageBitmap` itself: WebGL ignores
 * `UNPACK_FLIP_Y_WEBGL` for an `ImageBitmap`, and Phaser flips every texture it uploads, so a bitmap came out upside
 * down. A `bitmaprenderer` canvas takes the bitmap over without copying it and uploads like any other canvas.
 */
export function canvasOf(bitmap: ImageBitmap): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const renderer = canvas.getContext("bitmaprenderer");
  if (renderer) {
    renderer.transferFromImageBitmap(bitmap);
    return canvas;
  }
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}
