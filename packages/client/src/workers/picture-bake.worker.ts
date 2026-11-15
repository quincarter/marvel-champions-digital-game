/**
 * Bakes a picture off the main thread: fetches and decodes it, scales it to the slot it is drawn in (issue #722), mixes
 * its pixels to gray when asked (issue #716, `art/grayscale.ts`) on an `OffscreenCanvas`, and hands the bitmap back.
 * The main thread only uploads it.
 */
import { bakedSizeOf, grayscalePixels, type Size } from "../art/grayscale.js";
import type { BakeReply, BakeRequest } from "../art/picture-bake-client.js";

/** The client compiles with the DOM lib only, so this names the members of the worker global that are used. */
interface WorkerGlobal {
  postMessage(message: BakeReply, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<BakeRequest>) => void): void;
}
const worker = self as unknown as WorkerGlobal;

async function bakedBitmapOf(url: string, slot: Size, gray: boolean): Promise<ImageBitmap | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const source = await createImageBitmap(await response.blob());
  const size = bakedSizeOf(source, slot);
  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    source.close();
    throw new Error("No 2D context on an OffscreenCanvas here");
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, size.width, size.height);
  source.close();
  if (gray) {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    grayscalePixels(pixels.data);
    context.putImageData(pixels, 0, 0);
  }
  return canvas.transferToImageBitmap();
}

worker.addEventListener("message", (event) => {
  const { id, url, slot, gray } = event.data;
  bakedBitmapOf(url, slot, gray).then(
    (bitmap) => worker.postMessage({ id, bitmap }, bitmap ? [bitmap] : []),
    () => worker.postMessage({ id, bitmap: null, failed: true }),
  );
});
